import { createFileRoute } from "@tanstack/react-router";

const GRAPH_VERSION = "v23.0";
const PROFILE_FIELDS =
  "id,username,is_user_follow_business,is_business_follow_user";

type InstagramProfile = {
  id?: string;
  username?: string;
  is_user_follow_business?: boolean;
  is_business_follow_user?: boolean;
  error?: { message?: string; type?: string; code?: number };
};

async function fetchInstagramProfile(
  scopedId: string,
  accessToken: string,
): Promise<{ status: number; body: InstagramProfile }> {
  const url = `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(
    scopedId,
  )}?fields=${encodeURIComponent(PROFILE_FIELDS)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await res.json().catch(() => ({}))) as InstagramProfile;
  return { status: res.status, body };
}

export const Route = createFileRoute("/api/public/instagram/webhook")({
  server: {
    handlers: {
      // Meta webhook verification handshake
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const verifyToken = process.env["META_WEBHOOK_VERIFY_TOKEN"];
        if (!verifyToken) {
          console.error("[instagram-webhook] META_WEBHOOK_VERIFY_TOKEN is not configured");
          return new Response("Not configured", { status: 500 });
        }

        if (mode === "subscribe" && token === verifyToken && challenge) {
          return new Response(challenge, {
            status: 200,
            headers: { "content-type": "text/plain" },
          });
        }

        console.warn("[instagram-webhook] verification failed", { mode, hasChallenge: !!challenge });
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        const body = payload as {
          object?: string;
          entry?: Array<{
            id?: string;
            messaging?: Array<{
              sender?: { id?: string };
              recipient?: { id?: string };
              message?: { text?: string };
            }>;
          }>;
        };

        // TEMPORARY DIAGNOSTIC: log the payload *shape* only (keys + value
        // types), never raw text, tokens, or personal data.
        const shapeOf = (value: unknown, depth = 0): unknown => {
          if (value === null) return "null";
          if (Array.isArray(value))
            return value.length ? [shapeOf(value[0], depth + 1)] : [];
          if (typeof value === "object") {
            if (depth > 5) return "object";
            return Object.fromEntries(
              Object.entries(value as Record<string, unknown>).map(([k, v]) => [
                k,
                shapeOf(v, depth + 1),
              ]),
            );
          }
          return typeof value;
        };
        console.log(
          "[instagram-webhook] payload shape",
          JSON.stringify(shapeOf(payload)),
        );

        const entry = body.entry?.[0];
        const messaging = entry?.messaging?.[0];
        const professionalAccountId = entry?.id;
        const senderId = messaging?.sender?.id;
        const recipientId = messaging?.recipient?.id;
        const message = messaging?.message;
        const messageText = message?.text;

        console.log("[instagram-webhook] event received", {
          object: body.object,
          professionalAccountId,
          senderId,
          recipientId,
          hasMessage: !!message,
        });

        // Always ACK fast so Meta does not retry.
        if (!senderId || typeof messageText !== "string") {
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const verificationCode = messageText
          .toUpperCase()
          .match(/\b(AZOX-[A-HJ-NP-Z2-9]{8})\b/i)?.[1];
        if (!verificationCode) {
          console.warn("[instagram-webhook] message did not contain a verification code", {
            senderId,
          });
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const accessToken = process.env["INSTAGRAM_ACCESS_TOKEN"];
        if (!accessToken) {
          console.error("[instagram-webhook] INSTAGRAM_ACCESS_TOKEN is not configured");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        try {
          const { getExternalSupabaseAdmin } = await import(
            "@/integrations/external-supabase/admin.server"
          );
          const supabase = getExternalSupabaseAdmin();
          const nowIso = new Date().toISOString();

          // Atomically move exactly one matching, unexpired code out of
          // pending before doing any other work. Replays cannot claim it.
          const { data: claimedRows, error: claimError } = await supabase.rpc(
            "claim_instagram_verification_session",
            { _verification_code: verificationCode.toUpperCase() },
          );
          const session = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;

          if (claimError || !session) {
            console.warn("[instagram-webhook] invalid, expired, or consumed verification code", {
              senderId,
            });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          const { data: link } = await supabase
            .from("instagram_links")
            .select("telegram_user_id")
            .eq("instagram_scoped_id", senderId)
            .maybeSingle();

          const linkedTelegramId = link?.telegram_user_id as number | undefined;
          const telegramUserId = Number(session.telegram_user_id);
          const taskId = String(session.task_id);

          if (linkedTelegramId && linkedTelegramId !== telegramUserId) {
            await supabase.rpc("fail_instagram_verification_session", {
              _session_id: session.session_id,
            });
            console.warn("[instagram-webhook] scoped id already linked to another telegram user", {
              senderId,
            });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          const { status, body: profile } = await fetchInstagramProfile(senderId, accessToken);
          if (status < 200 || status >= 300 || profile.error) {
            await supabase.rpc("fail_instagram_verification_session", {
              _session_id: session.session_id,
            });
            console.error("[instagram-webhook] profile lookup failed", {
              status,
              error: profile.error?.message ?? "unknown_error",
              senderId,
            });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          const follows = profile.is_user_follow_business === true;
          console.log("[instagram-webhook] TEST RESULT", {
            username: profile.username,
            instagramScopedId: senderId,
            is_user_follow_business: profile.is_user_follow_business,
          });

          if (!follows) {
            await supabase.rpc("fail_instagram_verification_session", {
              _session_id: session.session_id,
            });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          const { data: completed, error: completionError } = await supabase.rpc(
            "complete_instagram_verification_session",
            {
              _session_id: session.session_id,
              _instagram_scoped_id: senderId,
              _instagram_username: profile.username ?? null,
              _checked_at: nowIso,
            },
          );

          if (completionError || completed !== true) {
            console.warn("[instagram-webhook] verification completion rejected", {
              senderId,
            });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          console.log("[instagram-webhook] verification complete", {
            telegramUserId,
            taskId,
            follows,
          });
        } catch (error) {
          console.error("[instagram-webhook] profile request threw", error);
        }


        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
