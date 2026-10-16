import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  verify: vi.fn(),
  getChainId: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  readContract: vi.fn(),
  http: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
  }),
}));
vi.mock("./telegram-auth.server", () => ({ verifyTelegramInitData: mocks.verify }));
vi.mock("./azox-secure.server", () => ({ db: mocks.db }));
vi.mock("@/integrations/external-supabase/admin.server", () => ({
  getExternalSupabaseAdmin: mocks.db,
}));
vi.mock("viem", () => ({
  http: mocks.http,
  createPublicClient: () => mocks,
}));

import { registerAirdropWallet } from "./azox-secure.functions";
import { readMyWalletRegistration } from "./profile.server";
import { AZOX_AIRDROP_ADDRESS, REGISTRATION_FEE } from "./contracts";

const wallet = "0x1234567890123456789012345678901234567890";
const hash = `0x${"a".repeat(64)}`;
const input = { initData: "verified-fixture", walletAddress: wallet, txHash: hash };
type Row = {
  telegram_id: number;
  chain_id: number;
  wallet_address: string;
  payment_tx_hash: string;
  registered_at: string;
};
let rows: Row[];
let reads: Array<Array<[string, unknown]>>;
let writes: Row[];

function database() {
  return {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      const query = {
        select: () => { if (table === "wallet_registrations") reads.push(filters); return query; },
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        ilike: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        order: () => query,
        limit: () => query,
        update: () => query,
        insert: (row: Row) => {
          const saved = { ...row, registered_at: "2026-10-16T22:45:00Z" };
          writes.push(saved);
          rows.push(saved);
          return query;
        },
        then: (resolve: (result: unknown) => unknown) => Promise.resolve({
          data: rows.filter((row) => filters.every(([key, value]) => row[key as keyof Row] === value)),
          error: null,
        }).then(resolve),
      };
      return query;
    },
  };
}

function row(chain_id: number, telegram_id = 42): Row {
  return { chain_id, telegram_id, wallet_address: wallet, payment_tx_hash: hash, registered_at: "2026-08-01T00:00:00Z" };
}

describe("Mainnet registration isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [];
    reads = [];
    writes = [];
    mocks.db.mockImplementation(database);
    mocks.verify.mockResolvedValue({ ok: true, user: { id: 42 } });
    mocks.getChainId.mockResolvedValue(4663);
    mocks.getTransaction.mockResolvedValue({ to: AZOX_AIRDROP_ADDRESS, from: wallet, value: REGISTRATION_FEE, chainId: 4663 });
    mocks.getTransactionReceipt.mockResolvedValue({ status: "success" });
    mocks.readContract.mockResolvedValue(true);
  });

  it("ignores old own and other-user testnet rows in every registration/conflict lookup", async () => {
    rows = [row(46630), row(46630, 99)];
    const result = await registerAirdropWallet({ data: input });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected mainnet registration");
    expect(result.registration?.registered_at).toBe("2026-10-16T22:45:00Z");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.chain_id).toBe(4663);
    expect(mocks.http).toHaveBeenCalledWith("https://rpc.mainnet.chain.robinhood.com");
    expect(reads).toHaveLength(4);
    for (const filters of reads) expect(filters).toContainEqual(["chain_id", 4663]);
  });

  it("still refuses a wallet or transaction belonging to another mainnet user", async () => {
    rows = [row(4663, 99)];
    expect(await registerAirdropWallet({ data: input })).toEqual({ ok: false, error: "conflict" });
    expect(writes).toHaveLength(0);
  });

  it("returns the existing own mainnet registration without verifying or inserting again", async () => {
    rows = [row(46630), { ...row(4663), registered_at: "2026-10-16T20:00:00Z" }];
    const result = await registerAirdropWallet({ data: input });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected mainnet registration");
    expect(result.registration?.registered_at).toBe("2026-10-16T20:00:00Z");
    expect(writes).toHaveLength(0);
    expect(mocks.getChainId).not.toHaveBeenCalled();
  });

  it("profile read returns null for only an old testnet row", async () => {
    rows = [row(46630)];
    expect(await readMyWalletRegistration({ initData: input.initData })).toEqual({ ok: true, registration: null });
    expect(reads[0]).toContainEqual(["chain_id", 4663]);
  });

  it("profile read selects the mainnet row even when the testnet row is older", async () => {
    rows = [row(46630), { ...row(4663), registered_at: "2026-10-16T20:00:00Z" }];
    expect(await readMyWalletRegistration({ initData: input.initData })).toEqual({
      ok: true, registration: { wallet_address: wallet, registered_at: "2026-10-16T20:00:00Z" },
    });
  });

  it.each([
    ["RPC chain id", () => mocks.getChainId.mockResolvedValue(46630)],
    ["transaction chain id", () => mocks.getTransaction.mockResolvedValue({ to: AZOX_AIRDROP_ADDRESS, from: wallet, value: REGISTRATION_FEE, chainId: 46630 })],
    ["receipt success", () => mocks.getTransactionReceipt.mockResolvedValue({ status: "reverted" })],
    ["contract destination", () => mocks.getTransaction.mockResolvedValue({ to: wallet, from: wallet, value: REGISTRATION_FEE, chainId: 4663 })],
    ["wallet sender", () => mocks.getTransaction.mockResolvedValue({ to: AZOX_AIRDROP_ADDRESS, from: AZOX_AIRDROP_ADDRESS, value: REGISTRATION_FEE, chainId: 4663 })],
    ["exact fee", () => mocks.getTransaction.mockResolvedValue({ to: AZOX_AIRDROP_ADDRESS, from: wallet, value: REGISTRATION_FEE + 1n, chainId: 4663 })],
    ["eligibility", () => mocks.readContract.mockResolvedValue(false)],
  ])("preserves verification of %s", async (_name, arrange) => {
    arrange();
    expect(await registerAirdropWallet({ data: input })).toEqual({ ok: false, error: "not_verified" });
    expect(writes).toHaveLength(0);
  });
});