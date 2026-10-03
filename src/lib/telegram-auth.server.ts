// Server-only: validates raw Telegram WebApp initData (HMAC-SHA256).
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

export type VerifiedTelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export type TelegramAuthError = "not_configured" | "missing" | "invalid" | "stale";

export type TelegramAuthResult =
  | { ok: true; user: VerifiedTelegramUser; startParam: string | null }
  | { ok: false; error: TelegramAuthError };

const enc = new TextEncoder();

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyTelegramInitData(
  initData: string | null | undefined,
  nowMs: number = Date.now(),
): Promise<TelegramAuthResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { ok: false, error: "not_configured" };
  if (!initData || initData.length > 8192) return { ok: false, error: "missing" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "invalid" };
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = await hmac(enc.encode("WebAppData"), token);
  const expected = toHex(await hmac(secret, dataCheckString));
  if (!safeEqual(expected, hash.toLowerCase())) return { ok: false, error: "invalid" };

  const authDate = Number(params.get("auth_date"));
  const nowSec = Math.floor(nowMs / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, error: "invalid" };
  if (nowSec - authDate > INIT_DATA_MAX_AGE_SECONDS) return { ok: false, error: "stale" };
  if (authDate - nowSec > 300) return { ok: false, error: "invalid" };

  let user: VerifiedTelegramUser | null = null;
  try {
    const parsed = JSON.parse(params.get("user") ?? "null") as VerifiedTelegramUser | null;
    if (parsed && Number.isSafeInteger(parsed.id) && parsed.id > 0) user = parsed;
  } catch {
    user = null;
  }
  if (!user) return { ok: false, error: "invalid" };

  return { ok: true, user, startParam: params.get("start_param") || null };
}
