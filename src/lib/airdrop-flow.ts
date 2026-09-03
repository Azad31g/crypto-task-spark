/**
 * AZOX Airdrop flow model — pure, SSR-safe, wallet-agnostic.
 *
 * Separation of concerns:
 *   wallet layer -> wagmi account -> on-chain truth -> Supabase mirror
 *
 * Nothing here touches Supabase, wagmi, or the wallet layer. It only derives
 * the current phase and classifies errors, so the backend can never gate
 * wallet connection, wallet approval, or the registration transaction.
 */

export type AirdropPhase =
  | "DISCONNECTED"
  | "CONNECTED"
  | "WRONG_NETWORK"
  | "CHECKING_ELIGIBILITY"
  | "NOT_REGISTERED"
  | "REQUESTING_TRANSACTION"
  | "WAITING_CONFIRMATION"
  | "VERIFYING_ON_CHAIN"
  | "SYNCING_BACKEND"
  | "SUCCESS";

export type AirdropErrorType =
  | "USER_REJECTED"
  | "INSUFFICIENT_FUNDS"
  | "WRONG_NETWORK"
  | "RPC_ERROR"
  | "TRANSACTION_ERROR"
  | "ELIGIBILITY_READ_ERROR"
  | "BACKEND_SYNC_ERROR";

/** Phases driven by the in-flight registration action, if any. */
export type ActivePhase = Extract<
  AirdropPhase,
  | "CHECKING_ELIGIBILITY"
  | "REQUESTING_TRANSACTION"
  | "WAITING_CONFIRMATION"
  | "VERIFYING_ON_CHAIN"
  | "SYNCING_BACKEND"
>;

export type AirdropPhaseInput = {
  isConnected: boolean;
  chainId: number | undefined;
  expectedChainId: number;
  /** On-chain eligibility read (authoritative). `undefined` = not read yet. */
  isEligibleOnChain: boolean | undefined;
  /** In-flight step of a manual registration, if one is running. */
  activePhase: ActivePhase | null;
};

/**
 * The blockchain is the only source of registration truth. A Supabase row is
 * never an input here, so a backend failure can never change the phase.
 */
export function deriveAirdropPhase(input: AirdropPhaseInput): AirdropPhase {
  if (!input.isConnected) return "DISCONNECTED";
  if (input.chainId !== input.expectedChainId) return "WRONG_NETWORK";
  if (input.activePhase) return input.activePhase;
  if (input.isEligibleOnChain === true) return "SUCCESS";
  if (input.isEligibleOnChain === false) return "NOT_REGISTERED";
  return "CONNECTED";
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function classifyAirdropError(error: unknown): AirdropErrorType {
  const message = errorMessageOf(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (
    code === "4001" ||
    /user rejected|user denied|denied transaction|rejected the request/i.test(message)
  ) {
    return "USER_REJECTED";
  }
  if (/insufficient funds|exceeds balance|funds for gas/i.test(message)) {
    return "INSUFFICIENT_FUNDS";
  }
  if (/wrong network|chain mismatch|chain not configured|unsupported chain/i.test(message)) {
    return "WRONG_NETWORK";
  }
  if (/rpc|transport|network request|failed to fetch|timeout/i.test(message)) {
    return "RPC_ERROR";
  }
  return "TRANSACTION_ERROR";
}

/**
 * An on-chain confirmed registration stays confirmed even when the backend
 * mirror write fails; the user must never be asked to pay twice.
 */
export function isRegistrationConfirmed(params: {
  verifiedOnChain: boolean;
  backendSynced: boolean;
}): boolean {
  return params.verifiedOnChain;
}
