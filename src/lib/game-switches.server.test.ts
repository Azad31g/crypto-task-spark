import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./azox-secure.server", () => ({ db: () => ({ rpc: mocks.rpc }) }));

import {
  assertGameEnabled,
  getGameSwitchesCached,
  isGameEnabled,
  resetGameSwitchCache,
} from "./game-switches.server";

describe("game switches cache", () => {
  beforeEach(() => {
    resetGameSwitchCache();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("treats explicit false as OFF and missing ids as ON", async () => {
    mocks.rpc.mockResolvedValue({ data: { snake: false, shoot: true }, error: null });
    expect(await isGameEnabled("snake")).toBe(false);
    expect(await isGameEnabled("shoot")).toBe(true);
    expect(await isGameEnabled("clicker")).toBe(true);
    expect(await assertGameEnabled("snake")).toEqual({ ok: false, error: "game_disabled" });
  });

  it("caches for 30 seconds and shares one in-flight request", async () => {
    vi.useFakeTimers();
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
    await Promise.all([getGameSwitchesCached(), getGameSwitchesCached()]);
    await getGameSwitchesCached();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_001);
    await getGameSwitchesCached();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("fails open to all ON, then to the last cached value", async () => {
    vi.useFakeTimers();
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await isGameEnabled("box")).toBe(true);
    mocks.rpc.mockResolvedValueOnce({ data: { box: false }, error: null });
    expect(await isGameEnabled("box")).toBe(false);
    vi.advanceTimersByTime(30_001);
    mocks.rpc.mockRejectedValueOnce(new Error("down"));
    expect(await isGameEnabled("box")).toBe(false);
  });
});
