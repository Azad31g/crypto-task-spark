import { describe, expect, it } from "vitest";
import { classifyAirdropError, deriveAirdropPhase, isRegistrationConfirmed } from "./airdrop-flow";

const CHAIN = 46630;

const base = {
  isConnected: true,
  chainId: CHAIN,
  expectedChainId: CHAIN,
  isEligibleOnChain: undefined,
  activePhase: null,
} as const;

describe("deriveAirdropPhase", () => {
  it("is DISCONNECTED without a wallet", () => {
    expect(deriveAirdropPhase({ ...base, isConnected: false })).toBe("DISCONNECTED");
  });

  it("is WRONG_NETWORK off chain 46630", () => {
    expect(deriveAirdropPhase({ ...base, chainId: 1 })).toBe("WRONG_NETWORK");
  });

  it("is CONNECTED before eligibility is known", () => {
    expect(deriveAirdropPhase(base)).toBe("CONNECTED");
  });

  it("is NOT_REGISTERED when the chain says not eligible", () => {
    expect(deriveAirdropPhase({ ...base, isEligibleOnChain: false })).toBe("NOT_REGISTERED");
  });

  it("is SUCCESS when the chain says eligible", () => {
    expect(deriveAirdropPhase({ ...base, isEligibleOnChain: true })).toBe("SUCCESS");
  });

  it("surfaces the in-flight step", () => {
    expect(deriveAirdropPhase({ ...base, activePhase: "WAITING_CONFIRMATION" })).toBe(
      "WAITING_CONFIRMATION",
    );
    expect(deriveAirdropPhase({ ...base, activePhase: "SYNCING_BACKEND" })).toBe("SYNCING_BACKEND");
  });

  it("never lets network state be skipped by an in-flight step", () => {
    expect(
      deriveAirdropPhase({
        ...base,
        chainId: 1,
        activePhase: "REQUESTING_TRANSACTION",
      }),
    ).toBe("WRONG_NETWORK");
  });
});

describe("classifyAirdropError", () => {
  it("detects user rejection by code and message", () => {
    expect(classifyAirdropError({ code: 4001 })).toBe("USER_REJECTED");
    expect(classifyAirdropError(new Error("User rejected the request"))).toBe("USER_REJECTED");
  });

  it("detects insufficient funds", () => {
    expect(classifyAirdropError(new Error("insufficient funds for gas"))).toBe(
      "INSUFFICIENT_FUNDS",
    );
  });

  it("detects wrong network", () => {
    expect(classifyAirdropError(new Error("chain mismatch"))).toBe("WRONG_NETWORK");
  });

  it("detects rpc failures", () => {
    expect(classifyAirdropError(new Error("failed to fetch"))).toBe("RPC_ERROR");
  });

  it("falls back to TRANSACTION_ERROR", () => {
    expect(classifyAirdropError(new Error("reverted"))).toBe("TRANSACTION_ERROR");
  });
});

describe("isRegistrationConfirmed", () => {
  it("stays confirmed when the backend mirror fails", () => {
    expect(isRegistrationConfirmed({ verifiedOnChain: true, backendSynced: false })).toBe(true);
  });

  it("is not confirmed by a backend row alone", () => {
    expect(isRegistrationConfirmed({ verifiedOnChain: false, backendSynced: true })).toBe(false);
  });
});
