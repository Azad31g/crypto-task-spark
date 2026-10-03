import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyTelegramInitData } from "./telegram-auth.server";

const TOKEN = "123456:TEST_TOKEN";

function sign(fields: Record<string, string>, token = TOKEN): string {
  const dcs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dcs).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = 1_800_000_000_000;
const user = JSON.stringify({ id: 42, first_name: "A" });

describe("verifyTelegramInitData", () => {
  beforeEach(() => { process.env["TELEGRAM_BOT_TOKEN"] = TOKEN; });
  afterEach(() => { delete process.env["TELEGRAM_BOT_TOKEN"]; });

  it("accepts valid fresh data", async () => {
    const r = await verifyTelegramInitData(sign({ auth_date: String(now / 1000 - 60), user, start_param: "ref1" }), now);
    expect(r).toEqual({ ok: true, user: { id: 42, first_name: "A" }, startParam: "ref1" });
  });
  it("rejects tampered data", async () => {
    const raw = sign({ auth_date: String(now / 1000), user }).replace("42", "43");
    expect(await verifyTelegramInitData(raw, now)).toEqual({ ok: false, error: "invalid" });
  });
  it("rejects wrong token", async () => {
    const raw = sign({ auth_date: String(now / 1000), user }, "other:token");
    expect(await verifyTelegramInitData(raw, now)).toEqual({ ok: false, error: "invalid" });
  });
  it("rejects stale data (>24h)", async () => {
    const raw = sign({ auth_date: String(now / 1000 - 86_401), user });
    expect(await verifyTelegramInitData(raw, now)).toEqual({ ok: false, error: "stale" });
  });
  it("reports missing token", async () => {
    delete process.env["TELEGRAM_BOT_TOKEN"];
    expect(await verifyTelegramInitData("x=1", now)).toEqual({ ok: false, error: "not_configured" });
  });
});
