import { Link, useLocation } from "@tanstack/react-router";
import { useAzox } from "@/components/azox/app-provider";

export function BoxAlertBanner() {
  const { isBoxOpen, boxSecondsRemaining, boxAlreadyOpened } = useAzox();
  const { pathname } = useLocation();

  if (!isBoxOpen || boxAlreadyOpened || pathname === "/games/box") return null;

  return (
    <Link
      to="/games/$game"
      params={{ game: "box" }}
      className="fixed inset-x-0 top-0 z-50 mx-auto flex w-full max-w-md items-center justify-between gap-3 bg-[#FF7A18] px-4 py-3 text-sm font-extrabold text-black shadow-[0_0_24px_#FF7A18] animate-pulse"
    >
      <span>🎁 AZOX Box is open! Tap to open it!</span>
      <span className="tabular-nums">{boxSecondsRemaining}s</span>
    </Link>
  );
}

export default BoxAlertBanner;
