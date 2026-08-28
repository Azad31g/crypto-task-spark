export function AzoxFooter({
  variant = "home",
}: {
  variant?: "home" | "profile";
}) {
  return (
    <footer className="mt-2 flex flex-col items-center gap-1 py-6 text-center">
      <p className="text-xs font-medium text-muted-foreground">
        By Guardex Quant LABs <span aria-hidden="true">{"👾"}</span>
      </p>
      <p className="text-[11px] text-muted-foreground/70">
        {variant === "profile"
          ? "AZOX Robinhood Chain token — Azad Bashqali"
          : "AZOX Token on Robinhood Chain"}
      </p>
    </footer>
  );
}
