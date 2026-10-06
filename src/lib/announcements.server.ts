import { z } from "zod";
import { getExternalSupabaseAdmin } from "@/integrations/external-supabase/admin.server";
import { verifyTelegramInitData } from "./telegram-auth.server";

export const readsQuerySchema = z.object({ initData: z.string().min(1).max(8192) });
export const markReadsSchema = readsQuerySchema.extend({
  seenIds: z.array(z.string().uuid()).max(50).optional(),
  openedIds: z.array(z.string().uuid()).max(50).optional(),
});
export type AnnouncementFailure = {
  ok: false;
  error: "invalid" | "missing" | "stale" | "not_configured" | "server_error";
};
export type AnnouncementReads = { ok: true; seen: string[]; opened: string[] };

const failure = (error: AnnouncementFailure["error"]): AnnouncementFailure => ({ ok: false, error });

async function verify(initData: string) {
  const auth = await verifyTelegramInitData(initData);
  return auth.ok ? auth.user.id : failure(auth.error);
}

export async function readAnnouncementReads(
  input: unknown,
): Promise<AnnouncementReads | AnnouncementFailure> {
  const parsed = readsQuerySchema.safeParse(input);
  if (!parsed.success) return failure("missing");
  try {
    const id = await verify(parsed.data.initData);
    if (typeof id !== "number") return id;
    const { data, error } = await getExternalSupabaseAdmin()
      .from("announcement_reads")
      .select("announcement_id, seen_at, opened_at")
      .eq("telegram_id", id)
      .limit(500);
    if (error) return failure("server_error");
    const rows = (data ?? []) as {
      announcement_id: string;
      seen_at: string | null;
      opened_at: string | null;
    }[];
    return {
      ok: true,
      seen: rows.filter((r) => r.seen_at).map((r) => r.announcement_id),
      opened: rows.filter((r) => r.opened_at).map((r) => r.announcement_id),
    };
  } catch {
    return failure("server_error");
  }
}

export async function writeAnnouncementReads(
  input: unknown,
): Promise<{ ok: true } | AnnouncementFailure> {
  const parsed = markReadsSchema.safeParse(input);
  if (!parsed.success) return failure("invalid");
  try {
    const id = await verify(parsed.data.initData);
    if (typeof id !== "number") return id;
    const seenIds = [...new Set(parsed.data.seenIds ?? [])];
    const openedIds = [...new Set(parsed.data.openedIds ?? [])];
    const all = [...new Set([...seenIds, ...openedIds])];
    if (!all.length) return { ok: true };
    const db = getExternalSupabaseAdmin();
    const { data, error } = await db.from("announcements").select("id").in("id", all);
    if (error) return failure("server_error");
    const existing = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
    const seen = seenIds.filter((x) => existing.has(x));
    const opened = openedIds.filter((x) => existing.has(x));
    if (seen.length) {
      const r = await db.from("announcement_reads").upsert(
        seen.map((announcement_id) => ({ telegram_id: id, announcement_id })),
        { onConflict: "telegram_id,announcement_id", ignoreDuplicates: true },
      );
      if (r.error) return failure("server_error");
    }
    if (opened.length) {
      const now = new Date().toISOString();
      const r = await db.from("announcement_reads").upsert(
        opened.map((announcement_id) => ({ telegram_id: id, announcement_id, opened_at: now })),
        { onConflict: "telegram_id,announcement_id" },
      );
      if (r.error) return failure("server_error");
    }
    return { ok: true };
  } catch {
    return failure("server_error");
  }
}
