// Pure visibility rule for stories (and reused for private announcements).
export function canSeeStory(input: {
  isPrivate: boolean;
  userId: number | null;
  isAdmin: boolean;
  recipients: ReadonlySet<number> | readonly number[];
}): boolean {
  if (!input.isPrivate) return true;
  if (input.isAdmin) return true;
  if (input.userId === null) return false;
  const r = input.recipients;
  return Array.isArray(r) ? r.includes(input.userId) : (r as ReadonlySet<number>).has(input.userId);
}
