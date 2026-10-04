import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/integrations/external-supabase/admin.server", () => ({
  getExternalSupabaseAdmin: mocks.db,
}));
import {
  commentStory,
  isStoryAdmin,
  readStories,
  safeStoryLink,
  storyActionSchema,
  storyCommentSchema,
  storyInsights,
  viewStory,
} from "./stories.server";
const token = "test:stories-token";
function signed(id: number) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id }) };
  const check = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac("sha256", key).update(check).digest("hex"),
  }).toString();
}
const storyId = "7bd0193c-05e8-4a9c-8514-1ad52d5cbffc";
function table(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gt", "order", "in", "upsert", "insert", "delete"])
    chain[method] = vi.fn(() => chain);
  chain["maybeSingle"] = vi.fn(async () => result);
  chain["then"] = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}
describe("Stories validation and privacy", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", token);
    mocks.db.mockReset();
  });
  it("accepts only UUID story ids and trims bounded comments", () => {
    expect(storyActionSchema.safeParse({ initData: "x", storyId: "bad" }).success).toBe(false);
    expect(storyCommentSchema.parse({ initData: "x", storyId, body: "  hello  " }).body).toBe(
      "hello",
    );
    for (const body of ["   ", "x".repeat(501)])
      expect(storyCommentSchema.safeParse({ initData: "x", storyId, body }).success).toBe(false);
  });
  it("permits only http and https story links", () => {
    expect(safeStoryLink("https://example.com")).toBe("https://example.com/");
    for (const url of ["javascript:alert(1)", "tg://test", "/relative", "data:text/html,x"])
      expect(safeStoryLink(url)).toBeNull();
  });
  it("rejects non-admin insights before accessing the database", async () => {
    expect(isStoryAdmin(42)).toBe(false);
    expect(await storyInsights({ initData: signed(42), storyId })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await storyInsights({ initData: "invalid", storyId })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("returns viewing-only stories without Telegram verification and no counts or identities", async () => {
    const row = {
      id: storyId,
      media_type: "image",
      media_url: "https://example.com/image.jpg",
      link_url: "javascript:alert(1)",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10000).toISOString(),
    };
    const from = vi.fn(() => table({ data: [row], error: null }));
    mocks.db.mockReturnValue({ from });
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const result = await readStories({});
    expect(result).toEqual({
      stories: [{ ...row, link_url: null, seen: false, liked: false }],
      engagement: false,
      isAdmin: false,
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("stories");
  });
  it("does not record the admin as a viewer", async () => {
    const from = vi.fn(() => table({ data: { id: storyId }, error: null }));
    mocks.db.mockReturnValue({ from });
    expect(await viewStory({ initData: signed(2143639881), storyId })).toEqual({ ok: true });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("stories");
  });
  it("refuses comments after five recorded comments", async () => {
    const from = vi.fn((name) =>
      table(
        name === "stories" ? { data: { id: storyId }, error: null } : { count: 5, error: null },
      ),
    );
    mocks.db.mockReturnValue({ from });
    expect(await commentStory({ initData: signed(42), storyId, body: "Hello" })).toEqual({
      ok: false,
      error: "too_many",
    });
  });
  it("handles invalid and inactive engagement without throwing", async () => {
    expect(await viewStory({ initData: "bad", storyId })).toEqual({ ok: false, error: "invalid" });
    mocks.db.mockReturnValue({ from: () => table({ data: null, error: null }) });
    expect(await viewStory({ initData: signed(42), storyId })).toEqual({
      ok: false,
      error: "inactive",
    });
  });
});
