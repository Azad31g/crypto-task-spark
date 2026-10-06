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

const failure = (error: AnnouncementFailure["error"]): AnnouncementFailure => ({
  ok: false,
  error,
});

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
    const { data, error } = await db.from("announcements").select("id,is_private").in("id", all);
    if (error) return failure("server_error");
    const rows = (data ?? []) as { id: string; is_private: boolean | null }[];
    const privateIds = rows.filter((r) => r.is_private).map((r) => r.id);
    let mine = new Set<string>();
    if (privateIds.length) {
      const rec = await db
        .from("announcement_recipients")
        .select("announcement_id")
        .eq("telegram_id", id)
        .in("announcement_id", privateIds);
      if (rec.error) return failure("server_error");
      mine = new Set(
        ((rec.data ?? []) as { announcement_id: string }[]).map((r) => r.announcement_id),
      );
    }
    // Private announcements count only for their recipients.
    const existing = new Set(rows.filter((r) => !r.is_private || mine.has(r.id)).map((r) => r.id));
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

export type PrivateAnnouncement = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};
export type PrivateAnnouncements = { ok: true; announcements: PrivateAnnouncement[] };

export async function readPrivateAnnouncements(
  input: unknown,
): Promise<PrivateAnnouncements | AnnouncementFailure> {
  const parsed = readsQuerySchema.safeParse(input);
  if (!parsed.success) return failure("missing");
  try {
    const id = await verify(parsed.data.initData);
    if (typeof id !== "number") return id;
    const db = getExternalSupabaseAdmin();
    const rec = await db
      .from("announcement_recipients")
      .select("announcement_id")
      .eq("telegram_id", id)
      .limit(500);
    if (rec.error) return failure("server_error");
    const ids = ((rec.data ?? []) as { announcement_id: string }[]).map((r) => r.announcement_id);
    if (!ids.length) return { ok: true, announcements: [] };
    const { data, error } = await db
      .from("announcements")
      .select("id,title,message,created_at")
      .eq("is_private", true)
      .in("id", ids)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return failure("server_error");
    return {
      ok: true,
      announcements: ((data ?? []) as PrivateAnnouncement[]).map((a) => ({
        id: String(a.id),
        title: String(a.title),
        message: String(a.message),
        created_at: String(a.created_at),
      })),
    };
  } catch {
    return failure("server_error");
  }
}
