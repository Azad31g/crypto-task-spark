import { createServerFn } from "@tanstack/react-start";
export type { AnnouncementReads, AnnouncementFailure } from "./announcements.server";
// Validation and Telegram verification happen server-side; failures are typed results.
export const getAnnouncementReads = createServerFn({ method: "POST" })
  .inputValidator((input: { initData: string }) => input)
  .handler(async ({ data }) =>
    (await import("./announcements.server")).readAnnouncementReads(data),
  );
export const markAnnouncementsRead = createServerFn({ method: "POST" })
  .inputValidator((input: { initData: string; seenIds?: string[]; openedIds?: string[] }) => input)
  .handler(async ({ data }) =>
    (await import("./announcements.server")).writeAnnouncementReads(data),
  );
