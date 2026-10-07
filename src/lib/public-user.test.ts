import { describe, expect, it } from "vitest";
import { PUBLIC_USER_COLUMNS, publicRowToDbUser } from "./public-user";

describe("publicRowToDbUser", () => {
  it("fills restricted fields with null/0", () => {
    const u = publicRowToDbUser({
      telegram_id: 5,
      username: "a",
      first_name: null,
      last_name: null,
      photo_url: null,
      points: 10,
      tasks_done: null,
      referral_count: 2,
      rank: "Bronze",
    });
    expect(u).toMatchObject({ telegram_id: 5, points: 10, tasks_done: 0, referral_count: 2 });
    expect(u.referral_code).toBeNull();
    expect(u.referred_by).toBeNull();
    expect(u.joined_at).toBeNull();
    expect(u.last_seen).toBeNull();
  });
  it("only requests anon-allowed columns", () => {
    expect(PUBLIC_USER_COLUMNS.split(",").sort()).toEqual(
      ["first_name", "last_name", "photo_url", "points", "rank", "referral_count", "tasks_done", "telegram_id", "username"],
    );
  });
});
