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

/** Signs a private object path; resolves null on failure. */
export type StorySigner = (path: string) => Promise<string | null>;

/**
 * Media URL to return for a story. Private stories get a signed URL from the
 * private bucket or null (= exclude the story); public ones are untouched.
 */
export async function resolveStoryMedia(
  story: { isPrivate: boolean; mediaUrl: string | null; mediaPath: string | null },
  sign: StorySigner,
): Promise<string | null> {
  if (!story.isPrivate) return String(story.mediaUrl ?? "");
  if (!story.mediaPath) return null;
  try {
    const url = await sign(story.mediaPath);
    return url ? url : null;
  } catch {
    return null;
  }
}
