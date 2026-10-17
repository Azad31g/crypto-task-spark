// Server-only cached reader for the admin game switches (service-role RPC).
import { db } from "./azox-secure.server";
import { allGamesOn, parseGameSwitches, type GameId, type GameSwitches } from "./game-switches";

export type { GameId, GameSwitches };

const TTL_MS = 30_000;

let cached: { value: GameSwitches; at: number } | null = null;
let inflight: Promise<GameSwitches> | null = null;

/** 30s module cache, one shared in-flight request; never throws (fail-open). */
export async function getGameSwitchesCached(): Promise<GameSwitches> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await db().rpc("get_game_switches");
      if (error) throw new Error(error.message);
      const value = parseGameSwitches(data);
      cached = { value, at: Date.now() };
      return value;
    } catch (e) {
      console.error("[game-switches] read failed", e instanceof Error ? e.message : e);
      return cached?.value ?? allGamesOn();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function isGameEnabled(id: GameId): Promise<boolean> {
  return (await getGameSwitchesCached())[id] !== false;
}

export async function assertGameEnabled(
  id: GameId,
): Promise<{ ok: true } | { ok: false; error: "game_disabled" }> {
  return (await isGameEnabled(id)) ? { ok: true } : { ok: false, error: "game_disabled" };
}

/** Test-only reset. */
export function resetGameSwitchCache(): void {
  cached = null;
  inflight = null;
}
