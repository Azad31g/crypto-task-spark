import { z } from 'zod';
import { getExternalSupabaseAdmin } from '@/integrations/external-supabase/admin.server';
import { verifyTelegramInitData } from './telegram-auth.server';

// Never export this identity to client-reachable modules.
const STORY_ADMIN_ID = 2143639881;
export const storyListSchema = z.object({ initData: z.string().max(8192).optional() });
export const storyActionSchema = z.object({ initData: z.string().min(1).max(8192), storyId: z.string().uuid() });
export const storyCommentSchema = storyActionSchema.extend({ body: z.string().trim().min(1).max(500) });
export type StoryFailure = { ok: false; error: 'invalid' | 'missing' | 'stale' | 'not_configured' | 'inactive' | 'too_many' | 'forbidden' | 'server_error' };
export type Story = { id: string; media_type: 'image' | 'video'; media_url: string; link_url: string | null; created_at: string; expires_at: string; seen: boolean; liked: boolean };
export type StoriesResult = { stories: Story[]; isAdmin: boolean; engagement: boolean; error?: string };
export type InsightPerson = { name: string; username: string | null; time: string; body?: string };
export type StoryInsights = { ok: true; viewers: InsightPerson[]; likers: InsightPerson[]; comments: InsightPerson[]; counts: { views: number; likes: number; comments: number } };
export function safeStoryLink(url: string | null): string | null {
  if (!url) return null;
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
}
export function isStoryAdmin(id: number): boolean { return id === STORY_ADMIN_ID; }
const failure = (error: StoryFailure['error']): StoryFailure => ({ ok: false, error });
function check<T>(result: { data: T; error: unknown }): T { if (result.error) throw new Error('Story database request failed'); return result.data; }
async function active(storyId: string) {
  return check(await getExternalSupabaseAdmin().from('stories').select('id').eq('id', storyId).gt('expires_at', new Date().toISOString()).maybeSingle());
}
export async function readStories(input: unknown): Promise<StoriesResult> {
  const parsed = storyListSchema.safeParse(input);
  const auth = await verifyTelegramInitData(parsed.success ? parsed.data.initData : undefined);
  const isAdmin = auth.ok && isStoryAdmin(auth.user.id);
  try {
    const db = getExternalSupabaseAdmin();
    const rows = check(await db.from('stories').select('id,media_type,media_url,link_url,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true })) ?? [];
    let seen = new Set<string>(); let liked = new Set<string>();
    if (auth.ok && rows.length) {
      const ids = rows.map((r) => String(r.id));
      const [views, likes] = await Promise.all([
        db.from('story_views').select('story_id').eq('telegram_id', auth.user.id).in('story_id', ids),
        db.from('story_likes').select('story_id').eq('telegram_id', auth.user.id).in('story_id', ids),
      ]);
      seen = new Set((check(views) ?? []).map((r) => String(r.story_id)));
      liked = new Set((check(likes) ?? []).map((r) => String(r.story_id)));
    }
    return { stories: rows.map((r) => ({ id: String(r.id), media_type: r.media_type as Story['media_type'], media_url: String(r.media_url), link_url: safeStoryLink(r.link_url), created_at: String(r.created_at), expires_at: String(r.expires_at), seen: isAdmin || seen.has(r.id), liked: liked.has(r.id) })), isAdmin, engagement: auth.ok };
  } catch { return { stories: [], isAdmin: false, engagement: false, error: 'server_error' }; }
}
export async function viewStory(input: unknown): Promise<{ ok: true } | StoryFailure> {
  const p = storyActionSchema.safeParse(input); if (!p.success) return failure('invalid');
  const a = await verifyTelegramInitData(p.data.initData); if (!a.ok) return failure(a.error);
  try {
    if (!await active(p.data.storyId)) return failure('inactive');
    if (!isStoryAdmin(a.user.id)) check(await getExternalSupabaseAdmin().from('story_views').upsert({ story_id: p.data.storyId, telegram_id: a.user.id }, { onConflict: 'story_id,telegram_id', ignoreDuplicates: true }));
    return { ok: true };
  } catch { return failure('server_error'); }
}
export async function likeStory(input: unknown): Promise<{ ok: true; liked: boolean } | StoryFailure> {
  const p = storyActionSchema.safeParse(input); if (!p.success) return failure('invalid');
  const a = await verifyTelegramInitData(p.data.initData); if (!a.ok) return failure(a.error);
  try {
    if (!await active(p.data.storyId)) return failure('inactive');
    const db = getExternalSupabaseAdmin();
    const existing = check(await db.from('story_likes').select('story_id').eq('story_id', p.data.storyId).eq('telegram_id', a.user.id).maybeSingle());
    if (existing) check(await db.from('story_likes').delete().eq('story_id', p.data.storyId).eq('telegram_id', a.user.id));
    else check(await db.from('story_likes').upsert({ story_id: p.data.storyId, telegram_id: a.user.id }, { onConflict: 'story_id,telegram_id', ignoreDuplicates: true }));
    return { ok: true, liked: !existing };
  } catch { return failure('server_error'); }
}
export async function commentStory(input: unknown): Promise<{ ok: true } | StoryFailure> {
  const p = storyCommentSchema.safeParse(input); if (!p.success) return failure('invalid');
  const a = await verifyTelegramInitData(p.data.initData); if (!a.ok) return failure(a.error);
  try {
    if (!await active(p.data.storyId)) return failure('inactive');
    const db = getExternalSupabaseAdmin();
    const { count, error } = await db.from('story_comments').select('id', { count: 'exact', head: true }).eq('story_id', p.data.storyId).eq('telegram_id', a.user.id);
    if (error) throw error;
    if ((count ?? 0) >= 5) return failure('too_many');
    check(await db.from('story_comments').insert({ story_id: p.data.storyId, telegram_id: a.user.id, body: p.data.body }));
    return { ok: true };
  } catch { return failure('server_error'); }
}
export async function storyInsights(input: unknown): Promise<StoryInsights | StoryFailure> {
  const p = storyActionSchema.safeParse(input); if (!p.success) return failure('forbidden');
  const a = await verifyTelegramInitData(p.data.initData);
  if (!a.ok || !isStoryAdmin(a.user.id)) return failure('forbidden');
  try {
    const db = getExternalSupabaseAdmin();
    // This is the only projection of engagement counts or other people's data.
    const [v, l, c] = await Promise.all([
      db.from('story_views').select('telegram_id,viewed_at').eq('story_id', p.data.storyId).order('viewed_at', { ascending: false }),
      db.from('story_likes').select('telegram_id,created_at').eq('story_id', p.data.storyId).order('created_at', { ascending: false }),
      db.from('story_comments').select('telegram_id,body,created_at').eq('story_id', p.data.storyId).order('created_at', { ascending: false }),
    ]);
    const viewers = check(v) ?? []; const likers = check(l) ?? []; const comments = check(c) ?? [];
    const ids = [...new Set([...viewers, ...likers, ...comments].map((r) => r.telegram_id))];
    const users = ids.length ? check(await db.from('users').select('telegram_id,username,first_name,last_name').in('telegram_id', ids)) ?? [] : [];
    const people = new Map(users.map((u) => [String(u.telegram_id), { name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'User', username: u.username ? `@${String(u.username).replace(/^@/, '')}` : null }]));
    const person = (id: unknown, time: string, body?: string): InsightPerson => ({ ...(people.get(String(id)) ?? { name: 'User', username: null }), time, ...(body === undefined ? {} : { body }) });
    return { ok: true, viewers: viewers.map((r) => person(r.telegram_id, r.viewed_at)), likers: likers.map((r) => person(r.telegram_id, r.created_at)), comments: comments.map((r) => person(r.telegram_id, r.created_at, r.body)), counts: { views: viewers.length, likes: likers.length, comments: comments.length } };
  } catch { return failure('server_error'); }
}
