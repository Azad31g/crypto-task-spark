import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Gamepad2, Trophy, ListChecks, User } from "lucide-react";
import { useNewTasks } from "@/hooks/useNewTasks";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/gaming", label: "Gaming", icon: Gamepad2 },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const { hasNew, markSeen } = useNewTasks();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname === "/tasks") markSeen();
  }, [pathname, markSeen]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-md items-stretch justify-between px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const showDot = tab.to === "/tasks" && hasNew;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.to === "/" }}
              className="group flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-accent hover:text-foreground"
            >
              <span className="relative flex size-9 items-center justify-center rounded-xl transition-all group-data-[status=active]:bg-accent/15 group-data-[status=active]:shadow-[0_0_0_1px_rgba(163,230,53,0.25),0_0_24px_rgba(163,230,53,0.18)]">
                <Icon className="size-5" aria-hidden="true" />
                {showDot && (
                  <span
                    className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#ef4444]"
                    aria-label="New tasks available"
                  />
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
