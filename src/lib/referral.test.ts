import { describe, expect, it } from "vitest";
import { REFERRAL_REWARD, normalizeReferralCode, runReferralSync, type ReferralDeps } from "./referral";
import { RANKS, rankForPoints } from "./ranks";
import { referralLinkFor } from "./referral-link";

type Row = {
  telegram_id: number;
  referral_code: string;
  points: number;
  referral_count: number;
  referred_by: number | null;
  rank: string | null;
};

/** In-memory model of the existing upsert_user first-creation behavior. */
function fakeDb(seed: Row[]) {
  const users = new Map(seed.map((r) => [r.telegram_id, { ...r }]));
  const referrals = new Set<number>();
  let n = 0;
  const deps = (id: number): ReferralDeps => ({
    userExists: async (t) => users.has(t),
    findReferrerByCode: async (c) =>
      [...users.values()].find((u) => u.referral_code === c)?.telegram_id ?? null,
    upsertUser: async (code) => {
      if (users.has(id)) return;
      const row: Row = { telegram_id: id, referral_code: `AZOX${++n}`, points: 0, referral_count: 0, referred_by: null, rank: null };
      users.set(id, row);
      const ref = code ? [...users.values()].find((u) => u.referral_code === code) : undefined;
      if (ref && ref.telegram_id !== id && !referrals.has(id)) {
        referrals.add(id);
        row.referred_by = ref.telegram_id;
        ref.points += REFERRAL_REWARD;
        ref.referral_count += 1;
      }
    },
    readReferredBy: async (t) => users.get(t)?.referred_by ?? null,
    recomputeRank: async (t) => {
      const u = users.get(t)!;
      u.rank = rankForPoints(u.points).key;
    },
  });
  return { users, deps };
}

const referrer = (): Row => ({
  telegram_id: 1,
  referral_code: "AZOXAAAAAA",
  points: RANKS[1]!.threshold - 500,
  referral_count: 0,
  referred_by: null,
  rank: RANKS[0]!.key,
});

describe("referral attribution", () => {
  it("valid code: +1000 once, count, referred_by, rank recomputed", async () => {
    const db = fakeDb([referrer()]);
    const r = await runReferralSync(2, "AZOXAAAAAA", db.deps(2));
    expect(r).toEqual({ outcome: "attributed", referrerId: 1 });
    const ref = db.users.get(1)!;
    expect(ref.points).toBe(RANKS[1]!.threshold + 500);
    expect(ref.referral_count).toBe(1);
    expect(db.users.get(2)!.referred_by).toBe(1);
    expect(ref.rank).toBe(RANKS[1]!.key);
  });

  it("rejects self referral", async () => {
    const db = fakeDb([]);
    // the user's own code cannot exist before the row; simulate a stale self-code
    db.users.set(3, { ...referrer(), telegram_id: 3, referral_code: "SELF" });
    db.users.delete(3);
    const deps = { ...db.deps(3), findReferrerByCode: async () => 3 };
    const r = await runReferralSync(3, "SELF", deps);
    expect(r.outcome).toBe("self_referral");
    expect(db.users.get(3)!.referred_by).toBeNull();
  });

  it("ignores invalid and unknown codes", async () => {
    const db = fakeDb([referrer()]);
    expect((await runReferralSync(4, "bad code!", db.deps(4))).outcome).toBe("invalid_code");
    expect((await runReferralSync(5, "NOPE", db.deps(5))).outcome).toBe("unknown_code");
    expect(db.users.get(1)!.points).toBe(referrer().points);
    expect(db.users.get(4)!.referred_by).toBeNull();
  });

  it("second attempt by the same user pays nothing", async () => {
    const db = fakeDb([referrer()]);
    await runReferralSync(2, "AZOXAAAAAA", db.deps(2));
    const r = await runReferralSync(2, "AZOXAAAAAA", db.deps(2));
    expect(r.outcome).toBe("existing_user");
    expect(db.users.get(1)!.points).toBe(referrer().points + REFERRAL_REWARD);
    expect(db.users.get(1)!.referral_count).toBe(1);
  });

  it("existing user opening another link is never re-attributed", async () => {
    const other: Row = { ...referrer(), telegram_id: 9, referral_code: "AZOXBBBBBB", points: 0 };
    const db = fakeDb([referrer(), other]);
    await runReferralSync(2, "AZOXAAAAAA", db.deps(2));
    const r = await runReferralSync(2, "AZOXBBBBBB", db.deps(2));
    expect(r.outcome).toBe("existing_user");
    expect(db.users.get(2)!.referred_by).toBe(1);
    expect(db.users.get(9)!.points).toBe(0);
    expect(db.users.get(9)!.referral_count).toBe(0);
  });

  it("normalizes codes", () => {
    expect(normalizeReferralCode(" AZOX12 ")).toBe("AZOX12");
    expect(normalizeReferralCode("a/b")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });

  it("builds the Mini App startapp link", () => {
    expect(referralLinkFor("AZOX12")).toBe("https://t.me/AZOX_Airdrop_bot/AZOX_Airdrop?startapp=AZOX12");
  });
});
