import { describe, expect, it } from "vitest";
import { mapClaimStatus, parseRpcStatus } from "./claim-status";
import { TAP_MIN_INTERVAL_SECONDS } from "./rate-limits";

const base = { points: 500, rank: "Bronze" };
describe("mapClaimStatus", () => {
  it("granted", () =>
    expect(mapClaimStatus({ status: "granted", ...base })).toEqual({
      ok: true,
      granted: true,
      ...base,
    }));
  it("duplicate is idempotent success", () =>
    expect(mapClaimStatus({ status: "duplicate", ...base })).toEqual({
      ok: true,
      granted: false,
      ...base,
    }));
  it("cooldown", () =>
    expect(mapClaimStatus({ status: "cooldown", ...base })).toEqual({
      ok: false,
      error: "cooldown",
    }));
  it("capped", () =>
    expect(mapClaimStatus({ status: "capped", ...base })).toEqual({ ok: false, error: "capped" }));
  it("unknown status", () =>
    expect(mapClaimStatus({ status: "weird", ...base })).toEqual({
      ok: false,
      error: "server_error",
    }));
});
describe("parseRpcStatus", () => {
  it("parses objects and arrays, rejects junk", () => {
    expect(parseRpcStatus({ status: "granted", points: "7", rank: "Gold" })).toEqual({
      status: "granted",
      points: 7,
      rank: "Gold",
    });
    expect(parseRpcStatus([{ status: "cooldown", points: 1 }])?.status).toBe("cooldown");
    expect(parseRpcStatus(null)).toBeNull();
    expect(parseRpcStatus({ points: 1 })).toBeNull();
  });
  it("tap interval is 570s", () => expect(TAP_MIN_INTERVAL_SECONDS).toBe(570));
});
