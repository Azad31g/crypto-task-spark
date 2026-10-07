// Pure: anon-visible users columns and mapping to the full DbUser shape.
export const PUBLIC_USER_COLUMNS =
  "telegram_id,username,first_name,last_name,photo_url,points,tasks_done,referral_count,rank";

export type PublicUserRow = {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  points: number | null;
  tasks_done: number | null;
  referral_count: number | null;
  rank: string | null;
};

export function publicRowToDbUser(r: PublicUserRow) {
  return {
    telegram_id: Number(r.telegram_id),
    username: r.username ?? null,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    points: Number(r.points ?? 0) || 0,
    tasks_done: Number(r.tasks_done ?? 0) || 0,
    referral_code: null,
    referred_by: null,
    referral_count: Number(r.referral_count ?? 0) || 0,
    photo_url: r.photo_url ?? null,
    rank: r.rank ?? null,
    joined_at: null,
    last_seen: null,
  };
}
