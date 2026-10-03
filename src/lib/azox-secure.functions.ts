import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rankForPoints } from "./ranks";
import {
  BOXES_PER_DAY,
  BOX_REWARD,
  CLICKER_COOLDOWN_MS,
  CLICKER_MAX_TAPS,
  CLICKER_POINTS_PER_TAP,
  DAILY_GIFT_POINTS,
  GLOBAL_BUTTON_ACTIVE_MS,
  GLOBAL_BUTTON_MAX_WINNERS,
  GLOBAL_BUTTON_REWARD,
  GLOBAL_BUTTON_SLOT_MS,
  MAX_GAME_SCORE,
  MAX_QUESTIONS_PER_DAY,
  QUESTION_POINTS,
  SCORE_GAMES,
  SOCIAL_TASK_POINTS,
  TAP_MAX_FINGERS,
  TASK_UNITS,
  WORDS_PER_DAY,
  WORD_POINTS,
} from "./rewards";
import { AZOX_AIRDROP_ABI, AZOX_AIRDROP_ADDRESS, REGISTRATION_FEE } from "./contracts";

/**
 * Every write here identifies the user ONLY from Telegram initData verified
 * server-side with the bot token. A browser-supplied telegram id or point
 * amount is never accepted.
 */

const initData = z.string().min(1).max(8192);
const taskId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_:.\-]+$/);

export type SecureError =
  | "not_configured"
  | "missing"
  | "invalid"
  | "stale"
  | "unknown_task"
  | "window_closed"
  | "already_claimed"
  | "full"
  | "not_verified"
  | "conflict"
  | "server_error";

type Fail = { ok: false; error: SecureError; message?: string };

async function auth(raw: string) {
  const { verifyTelegramInitData } = await import("./telegram-auth.server");
  return verifyTelegramInitData(raw);
}

async function helpers() {
  return import("./azox-secure.server");
}

function fail(error: SecureError, e?: unknown): Fail {
  if (e) console.error(`[azox-secure] ${error}`, e instanceof Error ? e.message : e);
  return { ok: false, error };
}

/* --------------------------------- syncUser -------------------------------- */

export const syncUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ initData }).parse(d))
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    try {
      const h = await helpers();
      const u = a.user;
      const { data: before } = await h
        .db()
        .from("users")
        .select("telegram_id")
        .eq("telegram_id", u.id)
        .maybeSingle();
      const isNew = !before;

      const base = {
        p_telegram_id: u.id,
        p_username: u.username ?? null,
        p_first_name: u.first_name ?? null,
        p_last_name: u.last_name ?? null,
        p_referral_code: a.startParam,
      };
      let { error } = await h.db().rpc("upsert_user", {
        ...base,
        p_photo_url: u.photo_url ?? null,
      });
      if (error) ({ error } = await h.db().rpc("upsert_user", base));
      if (error) return fail("server_error", error.message);

      const { data: row, error: readErr } = await h
        .db()
        .from("users")
        .select("*")
        .eq("telegram_id", u.id)
        .maybeSingle();
      if (readErr || !row) return fail("server_error", readErr?.message ?? "no row");

      // upsert_user awards the referrer +1000 only on first creation;
      // recompute the referrer's rank afterwards (adds nothing).
      if (isNew && row.referred_by) {
        try {
          await h.grantPoints(Number(row.referred_by), 0);
        } catch (e) {
          console.error("[azox-secure] referrer rank recompute failed", e);
        }
      }
      return { ok: true as const, user: row as Record<string, string | number | boolean | null> };
    } catch (e) {
      return fail("server_error", e);
    }
  });

/* ------------------------------- claimReward ------------------------------- */

const claimSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tap"), fingers: z.number().int().min(1).max(TAP_MAX_FINGERS) }),
  z.object({ type: z.literal("social_task"), taskId }),
  z.object({ type: z.literal("daily_gift") }),
  z.object({ type: z.literal("box_open"), session: z.number().int().min(0).max(BOXES_PER_DAY - 1) }),
  z.object({ type: z.literal("word_correct"), index: z.number().int().min(0).max(WORDS_PER_DAY - 1) }),
  z.object({
    type: z.literal("question_correct"),
    index: z.number().int().min(0).max(MAX_QUESTIONS_PER_DAY - 1),
  }),
  z.object({ type: z.literal("clicker_round"), taps: z.number().int().min(1).max(CLICKER_MAX_TAPS) }),
  z.object({
    type: z.literal("game_score"),
    gameId: z.enum(SCORE_GAMES),
    score: z.number().int().min(1).max(MAX_GAME_SCORE),
  }),
]);

export const claimReward = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ initData, claim: claimSchema }).parse(d))
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    const id = a.user.id;
    const c = data.claim;
    try {
      const h = await helpers();
      const day = h.utcDay();
      const once = async (key: string, pts: number) => {
        const r = await h.claimOnce(id, key, pts);
        return { ok: true as const, granted: r.granted, points: r.points, rank: r.rank };
      };
      switch (c.type) {
        case "tap": {
          const per = rankForPoints(await h.currentPoints(id)).pointsPerFinger;
          const r = await h.grantPoints(id, c.fingers * per);
          return { ok: true as const, granted: true, points: r.points, rank: r.rank };
        }
        case "game_score": {
          const r = await h.grantPoints(id, c.score);
          return { ok: true as const, granted: true, points: r.points, rank: r.rank };
        }
        case "social_task": {
          const t = await h.findTask(c.taskId);
          const pts = t?.points ?? SOCIAL_TASK_POINTS[c.taskId];
          if (!pts || pts <= 0) return fail("unknown_task");
          return once(`task-${c.taskId}`, pts);
        }
        case "daily_gift":
          return once(`daily-gift-${day}`, DAILY_GIFT_POINTS);
        case "box_open":
          return once(`box-${day}-${c.session}`, BOX_REWARD);
        case "word_correct":
          return once(`word-${day}-${c.index}`, WORD_POINTS);
        case "question_correct":
          return once(`question-${day}-${c.index}`, QUESTION_POINTS);
        case "clicker_round": {
          const slot = Math.floor(Date.now() / CLICKER_COOLDOWN_MS);
          return once(`clicker-${slot}`, c.taps * CLICKER_POINTS_PER_TAP);
        }
      }
    } catch (e) {
      return fail("server_error", e);
    }
  });

/* ------------------------------ tasks / units ------------------------------ */

/** Records a social task completion (+ its DB-defined bonus task units). */
export const recordTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ initData, taskId }).parse(d))
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    try {
      const h = await helpers();
      const t = await h.findTask(data.taskId);
      if (!t && SOCIAL_TASK_POINTS[data.taskId] === undefined) return fail("unknown_task");
      await h.insertTaskIds(a.user.id, [data.taskId]);
      if (t && t.taskReward > 0) {
        await h.insertTaskIds(a.user.id, h.unitIds(`${data.taskId}-reward`, t.taskReward));
      }
      return { ok: true as const, tasksDone: await h.recomputeTasksDone(a.user.id) };
    } catch (e) {
      return fail("server_error", e);
    }
  });

/** Game achievement task units — units and ids decided by the server. */
export const recordTaskUnits = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        initData,
        kind: z.enum(["word_complete", "box_open", "question_complete", "daily_streak"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    try {
      const h = await helpers();
      const day = h.utcDay();
      const base = {
        word_complete: `game-word-complete-${day}`,
        box_open: `game-box-open-${day}`,
        question_complete: `game-question-complete-${day}`,
        daily_streak: `game-streak-${day}`,
      }[data.kind];
      const added = await h.insertTaskIds(a.user.id, h.unitIds(base, TASK_UNITS[data.kind]));
      return { ok: true as const, added, tasksDone: await h.recomputeTasksDone(a.user.id) };
    } catch (e) {
      return fail("server_error", e);
    }
  });

/** Re-syncs users.tasks_done for the verified user. */
export const syncTasksDone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ initData }).parse(d))
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    try {
      const h = await helpers();
      return { ok: true as const, tasksDone: await h.recomputeTasksDone(a.user.id) };
    } catch (e) {
      return fail("server_error", e);
    }
  });

/* ------------------------------ submitGameScore ---------------------------- */

export const submitGameScore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        initData,
        gameId: z.enum(SCORE_GAMES),
        score: z.number().int().min(1).max(MAX_GAME_SCORE),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    const id = a.user.id;
    try {
      const h = await helpers();
      const { data: isRecord, error } = await h.db().rpc("submit_global_best", {
        p_game_id: data.gameId,
        p_score: data.score,
        p_telegram_id: id,
        p_name: a.user.first_name ?? null,
      });
      if (error) return fail("server_error", error.message);
      if (isRecord !== true) return { ok: true as const, newRecord: false, earnedTasks: 0 };

      // Personal score (same upsert as before, only on a new world record).
      const { error: psErr } = await h
        .db()
        .from("game_scores")
        .upsert(
          { telegram_id: id, game_id: data.gameId, score: data.score, is_best: true },
          { onConflict: "telegram_id,game_id" },
        );
      if (psErr) console.error("[azox-secure] game_scores upsert failed", psErr.message);

      await h.insertTaskIds(
        id,
        h.unitIds(`game-world-record-${data.gameId}-${data.score}`, TASK_UNITS.world_record),
      );
      await h.recomputeTasksDone(id);
      return { ok: true as const, newRecord: true, earnedTasks: TASK_UNITS.world_record };
    } catch (e) {
      return fail("server_error", e);
    }
  });

/* ----------------------------- globalButtonPress --------------------------- */

export const globalButtonPress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ initData }).parse(d))
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    const id = a.user.id;
    const now = Date.now();
    const slot = Math.floor(now / GLOBAL_BUTTON_SLOT_MS) * GLOBAL_BUTTON_SLOT_MS;
    if (now - slot >= GLOBAL_BUTTON_ACTIVE_MS) return fail("window_closed");
    const rowId = `game-global-button-${slot}`;
    try {
      const h = await helpers();
      const { data: mine } = await h
        .db()
        .from("user_tasks")
        .select("task_id")
        .eq("telegram_id", id)
        .eq("task_id", rowId)
        .maybeSingle();
      if (mine) return fail("already_claimed");

      const { count, error: cErr } = await h
        .db()
        .from("user_tasks")
        .select("telegram_id", { count: "exact", head: true })
        .eq("task_id", rowId);
      if (cErr) return fail("server_error", cErr.message);
      if ((count ?? 0) >= GLOBAL_BUTTON_MAX_WINNERS) return fail("full");

      const added = await h.insertTaskIds(id, [rowId]);
      if (added === 0) return fail("already_claimed");
      await h.recomputeTasksDone(id);
      const r = await h.claimOnce(id, `global-button-${slot}`, GLOBAL_BUTTON_REWARD);
      return { ok: true as const, granted: r.granted, points: r.points, rank: r.rank, slot };
    } catch (e) {
      return fail("server_error", e);
    }
  });

/* --------------------------- registerAirdropWallet ------------------------- */

const CHAIN_ID = 46630;
const RPC_URL = "https://rpc.testnet.chain.robinhood.com";

export const registerAirdropWallet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        initData,
        walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const a = await auth(data.initData);
    if (!a.ok) return fail(a.error);
    const telegramId = a.user.id;
    const wallet = data.walletAddress.toLowerCase();
    const hash = data.txHash.toLowerCase() as `0x${string}`;
    try {
      const h = await helpers();

      // First registration per telegram_id wins.
      const { data: existing } = await h
        .db()
        .from("wallet_registrations")
        .select("wallet_address, registered_at")
        .eq("telegram_id", telegramId)
        .order("registered_at", { ascending: true })
        .limit(1);
      if (existing?.[0]) return { ok: true as const, registration: existing[0] };

      const { createPublicClient, http } = await import("viem");
      const client = createPublicClient({ transport: http(RPC_URL) });
      if ((await client.getChainId()) !== CHAIN_ID) return fail("not_verified");
      const [tx, receipt] = await Promise.all([
        client.getTransaction({ hash }),
        client.getTransactionReceipt({ hash }),
      ]);
      const ok =
        receipt.status === "success" &&
        tx.to?.toLowerCase() === AZOX_AIRDROP_ADDRESS.toLowerCase() &&
        tx.from.toLowerCase() === wallet &&
        tx.value === REGISTRATION_FEE &&
        (tx.chainId === undefined || tx.chainId === CHAIN_ID);
      if (!ok) return fail("not_verified");
      const eligible = await client.readContract({
        address: AZOX_AIRDROP_ADDRESS,
        abi: AZOX_AIRDROP_ABI,
        functionName: "isEligible",
        args: [wallet as `0x${string}`],
      });
      if (eligible !== true) return fail("not_verified");

      // Reject if this tx or wallet already belongs to a different user.
      const [{ data: byTx }, { data: byWallet }] = await Promise.all([
        h.db().from("wallet_registrations").select("telegram_id").ilike("payment_tx_hash", hash),
        h.db().from("wallet_registrations").select("telegram_id").ilike("wallet_address", wallet),
      ]);
      const others = [...(byTx ?? []), ...(byWallet ?? [])].some(
        (r: { telegram_id: number }) => Number(r.telegram_id) !== telegramId,
      );
      if (others) return fail("conflict");

      const { error } = await h.db().from("wallet_registrations").insert({
        telegram_id: telegramId,
        wallet_address: wallet,
        chain_id: CHAIN_ID,
        registration_fee: "0.0006",
        payment_tx_hash: hash,
        payment_status: "confirmed",
        is_current: true,
      });
      if (error) return fail("server_error", error.message);

      const { error: uErr } = await h
        .db()
        .from("users")
        .update({ airdrop_registered: true })
        .eq("telegram_id", telegramId);
      if (uErr) console.error("[azox-secure] airdrop_registered update failed", uErr.message);

      const { data: saved } = await h
        .db()
        .from("wallet_registrations")
        .select("wallet_address, registered_at")
        .eq("telegram_id", telegramId)
        .order("registered_at", { ascending: true })
        .limit(1);
      return { ok: true as const, registration: saved?.[0] ?? null };
    } catch (e) {
      return fail("server_error", e);
    }
  });
