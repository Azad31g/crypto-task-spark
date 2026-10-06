// Pure helpers for announcement unread state.
export function computeHasNew(ids: readonly string[], seen: ReadonlySet<string>): boolean {
  return ids.some((id) => !seen.has(id));
}
/** Ids that are not yet seen, in input order, without duplicates. */
export function computeUnseenIds(ids: readonly string[], seen: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!seen.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}
export function computeIsUnread(id: string, opened: ReadonlySet<string>): boolean {
  return !opened.has(id);
}
/** Legacy browser fallback: bell dot shows when newest created_at differs from the stored one. */
export function legacyHasNew(
  newestCreatedAt: string | undefined,
  lastSeen: string | null,
): boolean {
  return newestCreatedAt !== undefined && newestCreatedAt !== lastSeen;
}
/** Merge public + private lists: dedupe by id, newest first, keep `limit`. */
export function mergeAnnouncements<T extends { id: string; created_at: string }>(
  a: readonly T[],
  b: readonly T[],
  limit = 20,
): T[] {
  const byId = new Map<string, T>();
  for (const x of [...a, ...b]) if (!byId.has(x.id)) byId.set(x.id, x);
  return [...byId.values()]
    .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))
    .slice(0, limit);
}
