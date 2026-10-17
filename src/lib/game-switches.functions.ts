import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { GameSwitches } from "./game-switches";

type Result = { ok: true; switches: GameSwitches } | { ok: false; error: string };

export const getGameSwitches = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ initData: z.string().min(1).max(8192) }).parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const { verifyTelegramInitData } = await import("./telegram-auth.server");
    const v = await verifyTelegramInitData(data.initData);
    if (!v.ok) return { ok: false, error: v.error };
    const { getGameSwitchesCached } = await import("./game-switches.server");
    return { ok: true, switches: await getGameSwitchesCached() };
  });
