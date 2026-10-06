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
