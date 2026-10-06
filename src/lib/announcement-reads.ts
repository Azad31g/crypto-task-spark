// Pure helpers for announcement unread state.
export function computeHasNew(ids: readonly string[], seen: ReadonlySet<string>): boolean {
  return ids.some((id) => !seen.has(id));
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
