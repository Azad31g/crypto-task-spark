import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, CheckCircle2 } from "lucide-react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useConfig,
  useSwitchChain,
  useSendTransaction,
  useDisconnect,
} from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { encodeFunctionData, formatEther } from "viem";
import { writeStorage } from "@/lib/points";
import {
  currentTelegramId,
  fetchWalletRegistration,
  saveWalletRegistration,
  type WalletRegistration,
} from "@/lib/azox-backend";
import {
  AZOX_AIRDROP_ABI,
  AZOX_AIRDROP_ADDRESS,
  REGISTRATION_FEE,
} from "@/lib/contracts";
import { robinhoodTestnet } from "@/lib/wagmi-config";



const KEYS = {
  address: "azox_wallet_address",
  registered: "azox_airdrop_registered",
  date: "azox_airdrop_date",
};

const WalletButton = lazy(() =>
  import("@/lib/appkit-runtime").then((m) => ({ default: m.WalletButton })),
);

function WalletButtonFallback() {
  return (
    <span className="text-xs text-muted-foreground">Loading wallet…</span>
  );
}

function AppKitButton({ balance }: { balance?: "hide" }) {
  return (
    <ClientOnly fallback={<WalletButtonFallback />}>
      <Suspense fallback={<WalletButtonFallback />}>
        <WalletButton {...(balance ? { balance } : {})} />
      </Suspense>
    </ClientOnly>
  );
}





const ORANGE = "#FF7A18";
const GREEN = "#a3e635";
const FEE_LABEL = `${formatEther(REGISTRATION_FEE)} ETH`;
const GAS_RESERVE = BigInt("100000000000000");
const REQUIRED_BALANCE = REGISTRATION_FEE + GAS_RESERVE;

const registerData = encodeFunctionData({
  abi: AZOX_AIRDROP_ABI,
  functionName: "register",
  args: [],
});

type RegistrationErrorType =
  | "USER_REJECTED"
  | "INSUFFICIENT_FUNDS"
  | "WRONG_NETWORK"
  | "RPC_ERROR"
  | "TRANSACTION_ERROR"
  | "ELIGIBILITY_READ_ERROR";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function classifyTransactionError(error: unknown): RegistrationErrorType {
  const message = getErrorMessage(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (
    code === "4001" ||
    /user rejected|user denied|denied transaction|rejected the request/i.test(
      message,
    )
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

function shorten(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const STEPS = [
  { icon: "🔗", text: "Connect your wallet" },
  { icon: "💎", text: `Pay ${FEE_LABEL} registration fee` },
  { icon: "🎁", text: "Receive AZOX tokens at airdrop" },
];

const FAQ = [
  {
    q: "What is the AZOX Airdrop?",
    a: "AZOX token distribution to early community members on Robinhood Chain Testnet.",
  },
  {
    q: "Why is a fee required?",
    a: `The ${FEE_LABEL} fee confirms wallet ownership and prevents bot registrations.`,
  },
  {
    q: "Which network do I need?",
    a: `Robinhood Chain Testnet (Chain ID ${robinhoodTestnet.id}).`,
  },
  {
    q: "How many tokens will I receive?",
    a: "Distribution is based on your points rank and activity on the platform.",
  },
];

function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute block size-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            top: "-10%",
            background: i % 3 === 0 ? ORANGE : i % 3 === 1 ? GREEN : "#ffffff",
            animation: `azox-confetti 1.6s ${(i % 8) * 0.12}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`@keyframes azox-confetti{to{transform:translateY(320px) rotate(540deg);opacity:0}}`}</style>
    </div>
  );
}

export function AirdropPage() {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain, switchChainAsync, isPending: isSwitching } =
    useSwitchChain();
  const wagmiConfig = useConfig();

  const [confetti, setConfetti] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isConfirming, setIsConfirming] = useState(false);
  // On-chain registration succeeded but the backend write did not — the tx is
  // still valid, we only need to retry the data sync (never the payment).
  const [syncFailed, setSyncFailed] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const [dbRegistration, setDbRegistration] =
    useState<WalletRegistration | null>(null);

  // Background read only — it never gates connecting or paying.

  useEffect(() => {
    const telegramId = currentTelegramId();
    if (!telegramId) return;
    let active = true;
    void fetchWalletRegistration(telegramId).then((row) => {
      if (active && row) setDbRegistration(row);
    });
    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
    const handler = () => {
      console.info("[airdrop] visibilitychange", {
        state: document.visibilityState,
        isConnected,
        address,
        chainId,
        href: window.location.href,
      });
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [isConnected, address, chainId]);

  useEffect(() => {
    console.info("[airdrop] account:state", {
      isConnected,
      address,
      chainId,
      timestamp: Date.now(),
    });
  }, [isConnected, address, chainId]);

  const { data: balance, refetch: refetchBalance } = useBalance({
    address,
    chainId: robinhoodTestnet.id,
    query: { enabled: Boolean(address) },
  });

  const { data: isEligible, refetch: refetchEligible } = useReadContract({
    address: AZOX_AIRDROP_ADDRESS,
    abi: AZOX_AIRDROP_ABI,
    functionName: "isEligible",
    args: address ? [address] : undefined,
    chainId: robinhoodTestnet.id,
    query: { enabled: Boolean(address) },
  });

  const { data: totalRegistered } = useReadContract({
    address: AZOX_AIRDROP_ADDRESS,
    abi: AZOX_AIRDROP_ABI,
    functionName: "totalRegistered",
    chainId: robinhoodTestnet.id,
  });

  const {
    sendTransactionAsync,
    data: txHash,
    isPending: isTxPending,
    error: txError,
    reset: resetTx,
  } = useSendTransaction();

  const [flowError, setFlowError] = useState<string | null>(null);

  const isWrongNetwork = isConnected && chainId !== robinhoodTestnet.id;
  const hasEnoughBalance = Boolean(balance && balance.value >= REQUIRED_BALANCE);
  // ON-CHAIN STATE IS AUTHORITATIVE. A Supabase wallet_registrations row is
  // only a display hint while no wallet is connected — it must never suppress
  // connecting or paying, and it must never claim eligibility the chain denies.
  const isRegistered = address
    ? isEligible === true
    : dbRegistration !== null;
  const busy = isTxPending || isConfirming;

  // MANUAL ONLY: never called from an effect. Connecting a wallet must never
  // send a transaction — the user presses "Register Now" explicitly.
  const handleRegister = async () => {
    if (registrationInFlightRef.current) return;
    registrationInFlightRef.current = true;
    resetTx();
    setFlowError(null);
    console.info("[airdrop] REGISTRATION_TRIGGERED", {
      manual: true,
      address,
      chainId,
    });


    try {
      if (!isConnected || !address) {
        throw new Error("Wallet is not connected");
      }

      console.info("[airdrop] CONNECTED", { address, chainId });

      if (chainId !== robinhoodTestnet.id) {
        try {
          const switchedChain = await switchChainAsync({
            chainId: robinhoodTestnet.id,
          });
          if (switchedChain.id !== robinhoodTestnet.id) {
            throw new Error(
              `Wrong network: expected chain ${robinhoodTestnet.id}, received ${switchedChain.id}`,
            );
          }
        } catch (error) {
          setFlowError(`WRONG_NETWORK: ${getErrorMessage(error)}`);
          return;
        }
      }

      const balanceResult = await refetchBalance();
      if (balanceResult.error) {
        setFlowError(`RPC_ERROR: ${getErrorMessage(balanceResult.error)}`);
        return;
      }
      if (!balanceResult.data || balanceResult.data.value < REQUIRED_BALANCE) {
        const available = balanceResult.data
          ? formatEther(balanceResult.data.value)
          : "0";
        setFlowError(
          `INSUFFICIENT_FUNDS: ${available} ETH available; ${FEE_LABEL} plus approximately ${formatEther(GAS_RESERVE)} ETH gas reserve required.`,
        );
        return;
      }

      console.info("[airdrop] CHECKING_ELIGIBILITY");
      let eligibility;
      try {
        eligibility = await refetchEligible();
      } catch (error) {
        setFlowError(`ELIGIBILITY_READ_ERROR: ${getErrorMessage(error)}`);
        return;
      }
      if (eligibility.error) {
        setFlowError(
          `ELIGIBILITY_READ_ERROR: ${getErrorMessage(eligibility.error)}`,
        );
        return;
      }
      console.info("[airdrop] ELIGIBILITY_RESULT", {
        eligible: eligibility.data,
      });
      if (eligibility.data === true) return;
      if (eligibility.data !== false) {
        setFlowError(
          "ELIGIBILITY_READ_ERROR: The eligibility check returned no result.",
        );
        return;
      }

      console.info("[airdrop] REQUESTING_TRANSACTION", {
        from: address,
        to: AZOX_AIRDROP_ADDRESS,
        chainId: robinhoodTestnet.id,
        valueWei: REGISTRATION_FEE.toString(),
        valueEth: formatEther(REGISTRATION_FEE),
      });
      console.info("[airdrop] WALLET_CONFIRMATION_REQUESTED");
      const hash = await sendTransactionAsync({
        to: AZOX_AIRDROP_ADDRESS,
        data: registerData,
        value: REGISTRATION_FEE,
        chainId: robinhoodTestnet.id,
      });
      
      console.info("[airdrop] TRANSACTION_SUBMITTED", { hash });
      console.info("[airdrop] WAITING_FOR_RECEIPT");
      setIsConfirming(true);
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: robinhoodTestnet.id,
      });
      console.info("[airdrop] TRANSACTION_CONFIRMED", {
        hash,
        status: receipt.status,
      });
      if (receipt.status !== "success") {
        setFlowError(
          `TRANSACTION_ERROR: Transaction reverted (${receipt.transactionHash})`,
        );
        return;
      }

      const verification = await refetchEligible();
      if (verification.error) {
        setFlowError(
          `ELIGIBILITY_READ_ERROR: ${getErrorMessage(verification.error)}`,
        );
        return;
      }
      if (verification.data !== true) {
        setFlowError(
          "TRANSACTION_ERROR: Transaction succeeded, but registration was not verified on-chain.",
        );
        return;
      }
      console.info("[airdrop] REGISTRATION_VERIFIED");
      setLastTxHash(hash);
      setSyncFailed(false);
      const telegramId = currentTelegramId();
      if (telegramId) {
        // Backend is a data layer only: a failure here NEVER invalidates the
        // confirmed on-chain registration and never re-requests payment.
        let saved: WalletRegistration | null = null;
        try {
          saved = await saveWalletRegistration({
            telegramId,
            walletAddress: address,
            chainId: robinhoodTestnet.id,
            txHash: hash,
          });
        } catch (syncError) {
          console.error("[airdrop] SUPABASE_SAVE_ERROR", syncError);
        }
        console.info("[airdrop] SUPABASE_SAVE_RESULT", {
          telegramId,
          saved: Boolean(saved),
        });
        if (saved) setDbRegistration(saved);
        else setSyncFailed(true);
      } else {
        console.info("[airdrop] SUPABASE_SAVE_SKIPPED", {
          reason: "no telegram id",
        });
      }
      writeStorage(KEYS.registered, true);
      writeStorage(KEYS.address, address);
      writeStorage(KEYS.date, new Date().toISOString());
      setConfetti(true);
      setTimeout(() => setConfetti(false), 2200);
    } catch (error) {
      const type = classifyTransactionError(error);
      setFlowError(`${type}: ${getErrorMessage(error)}`);
      console.error(`[airdrop] ${type}`, error);
    } finally {
      setIsConfirming(false);

      registrationInFlightRef.current = false;
    }
  };


  // Registration is MANUAL. No effect ever starts a transaction; this ref only
  // prevents a double-submit from rapid taps on the Register button.
  const registrationInFlightRef = useRef(false);



  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link
          to="/profile"
          aria-label="Back to profile"
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-secondary/40 text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">AZOX Airdrop</h1>
          <p className="text-xs text-muted-foreground">Register your wallet</p>
        </div>
      </header>

      {/* Hero */}
      <section
        className="rounded-2xl p-6 text-center"
        style={{
          background: "#0d0d0d",
          border: `1px solid ${ORANGE}`,
          boxShadow:
            "0 0 0 1px rgba(255,122,24,0.25), 0 10px 32px rgba(255,122,24,0.2)",
        }}
      >
        <div style={{ fontSize: 64, lineHeight: 1 }}>🪂</div>
        <h2 className="mt-3 text-base font-bold" style={{ color: ORANGE }}>
          AZOX Airdrop Registration
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Register once to qualify for AZOX token distribution on Robinhood Chain
          Testnet (Chain ID {robinhoodTestnet.id})
        </p>
        {totalRegistered !== undefined && (
          <p className="mt-2 text-xs font-semibold" style={{ color: GREEN }}>
            {totalRegistered.toString()} registered so far
          </p>
        )}
        <div
          className="mx-auto mt-4 h-0.5 w-20 rounded-full"
          style={{ background: ORANGE }}
        />
      </section>

      {/* How it works */}
      <section className="glass rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-bold">How it works</h2>
        <ul className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.text} className="flex items-center gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                style={{ color: GREEN, borderColor: GREEN }}
              >
                {i + 1}
              </span>
              <span className="text-sm" style={{ color: GREEN }}>
                {s.icon} {s.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Main action card */}
      <section
        className="relative rounded-2xl p-5"
        style={{
          background: "#0d0d0d",
          border: `1px solid ${isRegistered ? GREEN : ORANGE}`,
          boxShadow: isRegistered
            ? "0 8px 24px rgba(163,230,53,0.18)"
            : "0 8px 24px rgba(255,122,24,0.18)",
        }}
      >
        {confetti && <Confetti />}

        {isRegistered && (
          <div className="space-y-2 text-center">
            <div style={{ fontSize: 48, lineHeight: 1 }}>✅</div>
            <h2 className="text-base font-bold" style={{ color: GREEN }}>
              Airdrop Eligible!
            </h2>
            {(dbRegistration?.wallet_address ?? address) && (
              <p className="text-xs text-muted-foreground">
                Wallet:{" "}
                <code className="text-foreground">
                  {shorten(dbRegistration?.wallet_address ?? address!)}
                </code>
              </p>
            )}
            {dbRegistration?.registered_at && (
              <p className="text-xs text-muted-foreground">
                Registered:{" "}
                <span className="text-foreground">
                  {new Date(dbRegistration.registered_at).toLocaleDateString()}
                </span>
              </p>
            )}
            <p className="text-xs" style={{ color: GREEN }}>
              Registration confirmed on Robinhood Chain ✓
            </p>
            <button
              onClick={() => {
                // UI-only reset. The on-chain registration and the Supabase
                // row stay untouched; we only drop the local display state
                // that keeps the Eligible card visible, so the AppKit
                // "Connect Wallet" entry point comes back and another wallet
                // can be chosen. No automatic re-registration, no fee.
                disconnect();
                setDbRegistration(null);
                setSyncFailed(false);
                setLastTxHash(null);
                setFlowError(null);
                setConfetti(false);
                resetTx();
              }}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px",
                background: "none",
                border: "1px solid #444",
                borderRadius: 10,
                color: "#888",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🔌 Change Wallet
            </button>
          </div>
        )}

        {!isConnected && !isRegistered && (
          <div className="space-y-3">
            <h2 className="text-base font-bold" style={{ color: ORANGE }}>
              Connect Your Wallet
            </h2>
            <p className="text-xs text-muted-foreground">
              Supports MetaMask, Trust Wallet, Phantom, Coinbase & more
            </p>
            <span
              className="inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: ORANGE, borderColor: ORANGE }}
            >
              Robinhood Chain Testnet
            </span>
            <div className="flex justify-center">
              <AppKitButton />
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              One-time registration fee: {FEE_LABEL}
            </p>
          </div>
        )}

        {isConnected && isWrongNetwork && !isRegistered && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold" style={{ color: ORANGE }}>
              ⚠️ Wrong network detected
            </h2>
            <p className="text-xs text-muted-foreground">
              Switch to Robinhood Chain Testnet to continue
            </p>
            <button
              onClick={() => switchChain({ chainId: robinhoodTestnet.id })}
              disabled={isSwitching}
              className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: ORANGE }}
            >
              {isSwitching ? "Switching…" : "Switch to Robinhood Testnet"}
            </button>
          </div>
        )}

        {isConnected && !isWrongNetwork && !isRegistered && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className="size-4"
                    style={{ color: GREEN }}
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-bold">Wallet Connected</h2>
                </div>
                <code className="mt-1 block text-xs text-foreground">
                  {address ? shorten(address) : ""}
                </code>
              </div>
              <AppKitButton balance="hide" />
            </div>

            <p className="text-xs text-muted-foreground">
              Balance:{" "}
              <span className="font-semibold text-foreground">
                {balance
                  ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH`
                  : "Loading…"}
              </span>
            </p>
            {hasEnoughBalance ? (
              <p className="text-xs font-semibold" style={{ color: GREEN }}>
                ✓ Sufficient balance
              </p>
            ) : (
              <p className="text-xs font-semibold" style={{ color: ORANGE }}>
                ⚠ Insufficient balance
              </p>
            )}

            <button
              onClick={() => disconnect()}
              style={{
                width: "100%",
                padding: "10px",
                background: "none",
                border: "1px solid #444",
                borderRadius: 10,
                color: "#888",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🔌 Disconnect Wallet
            </button>

            <button
              onClick={() => {
                void handleRegister();
              }}
              disabled={!hasEnoughBalance || busy}
              className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:cursor-not-allowed"
              style={{
                background: hasEnoughBalance && !busy ? ORANGE : "#555555",
              }}
            >
              {isConfirming
                ? "⏳ Confirming on chain…"
                : isTxPending
                  ? "⏳ Confirm in your wallet…"
                  : !hasEnoughBalance
                    ? "Insufficient Balance"
                    : flowError || txError
                      ? `Retry Registration — ${FEE_LABEL}`
                      : `Register Now — ${FEE_LABEL}`}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              You confirm the transaction in your wallet • {FEE_LABEL} + gas
            </p>

            {syncFailed && (
              <p className="text-center text-[11px]" style={{ color: "#f59e0b" }}>
                ✅ On-chain registration confirmed
                {lastTxHash ? ` (${lastTxHash.slice(0, 10)}…)` : ""} — saving it
                to your profile failed. No new payment is needed; reopen this
                page to retry the sync.
              </p>
            )}




            {(flowError || txError) && (
              <div className="space-y-1 text-center">
                <p className="text-[11px]" style={{ color: "#ef4444" }}>
                  ❌ {(flowError ?? txError?.message ?? "").slice(0, 200)}
                </p>
                <button
                  onClick={() => {
                    setFlowError(null);
                    resetTx();
                  }}
                  className="text-[11px] underline"
                  style={{ color: ORANGE }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="glass rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-bold">FAQ</h2>
        <ul className="flex flex-col gap-2">
          {FAQ.map((item, i) => {
            const open = openFaq === i;
            return (
              <li
                key={item.q}
                className="rounded-xl border border-border bg-secondary/40"
              >
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold"
                >
                  {item.q}
                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <p className="px-3 pb-3 text-xs text-muted-foreground">
                    {item.a}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
