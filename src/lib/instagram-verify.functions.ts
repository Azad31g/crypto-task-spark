import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Starts an Instagram follow-verification session for a Telegram user.
 * The browser can only create a *pending* session — it can never mark a
 * task verified. Verification happens server-side in the Meta webhook.
 */
export const startInstagramVerification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        telegramUserId: z.number().int().positive(),
        taskId: z.string().min(1).max(128),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getExternalSupabaseAdmin } = await import(
      "@/integrations/external-supabase/admin.server"
    );
    const supabase = getExternalSupabaseAdmin();

    // Already verified for this task? Nothing to do.
    const { data: existing } = await supabase
      .from("instagram_verifications")
      .select("status, instagram_username")
      .eq("telegram_user_id", data.telegramUserId)
      .eq("task_id", data.taskId)
      .eq("status", "verified")
      .maybeSingle();

    if (existing) {
      return { ok: true as const, alreadyVerified: true, sessionId: null };
    }

    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

    // Expire stale sessions for this user so only one is claimable.
    await supabase
      .from("verification_sessions")
      .update({ status: "expired" })
      .eq("telegram_user_id", data.telegramUserId)
      .eq("platform", "instagram")
      .eq("status", "pending");

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let session:
      | { session_id: string; expires_at: string; verification_code: string }
      | null = null;
    let insertError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const random = new Uint8Array(8);
      crypto.getRandomValues(random);
      const suffix = Array.from(random, (byte) => alphabet[byte & 31]).join("");
      const verificationCode = `AZOX-${suffix}`;

      const result = await supabase
        .from("verification_sessions")
        .insert({
          telegram_user_id: data.telegramUserId,
          task_id: data.taskId,
          platform: "instagram",
          verification_code: verificationCode,
          status: "pending",
          expires_at: expiresAt,
        })
        .select("session_id, expires_at, verification_code")
        .single();

      if (!result.error && result.data) {
        const insertedSession = result.data as {
          session_id: string;
          expires_at: string;
          verification_code: string;
        };
        session = insertedSession;
        insertError = null;
        break;
      }

      insertError = result.error;
      if (result.error.code !== "23505") break;
    }

    if (!session) {
      console.error(
        "[ig-verify] failed to create session",
        insertError?.message ?? "code_generation_failed",
      );
      return { ok: false as const, error: "session_create_failed" };
    }

    return {
      ok: true as const,
      alreadyVerified: false,
      sessionId: session.session_id,
      verificationCode: session.verification_code,
      expiresAt: session.expires_at,
      instructions: [
        "Follow @azad__x_ on Instagram.",
        `Send the exact code ${session.verification_code} to @azad__x_ in an Instagram DM.`,
        "The code expires after 15 minutes.",
      ],
    };
  });

/** Server-side truth for whether a Telegram user passed the Instagram task. */
export const getInstagramVerificationStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        telegramUserId: z.number().int().positive(),
        taskId: z.string().min(1).max(128),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getExternalSupabaseAdmin } = await import(
      "@/integrations/external-supabase/admin.server"
    );
    const supabase = getExternalSupabaseAdmin();

    const { data: row, error } = await supabase
      .from("instagram_verifications")
      .select("status, instagram_username, verified_at, last_checked_at")
      .eq("telegram_user_id", data.telegramUserId)
      .eq("task_id", data.taskId)
      .maybeSingle();

    if (error) {
      console.error("[ig-verify] status read failed", error.message);
      return { ok: false as const, verified: false };
    }

    return {
      ok: true as const,
      verified: row?.status === "verified",
      status: row?.status ?? "none",
      instagramUsername: row?.instagram_username ?? null,
      verifiedAt: row?.verified_at ?? null,
      lastCheckedAt: row?.last_checked_at ?? null,
    };
  });
