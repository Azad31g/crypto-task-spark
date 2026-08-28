import { useState } from "react";
import { Crown, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  formatPoints,
  type RankKey,
  LEADERBOARD_TASKS,
  LEADERBOARD_REFERRALS,
} from "@/lib/azox-data";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useSupabaseLeaderboard } from "@/hooks/useSupabaseLeaderboard";
import { useAzox } from "@/components/azox/app-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type LeaderboardTab = "points" | "tasks" | "referrals";

const ACTIVE_TAB_COLOR = "#CCFF00";

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("points");
  const [activeRank, setActiveRank] = useState<RankKey>("Legendary");
  const {
    order: RANK_ORDER,
    players: pointUsers,
    thresholdFor,
    colorFor: rankColor,
  } = useLeaderboard(activeRank);
  const live = useSupabaseLeaderboard();
  const { user } = useAzox();
  const activeThreshold = thresholdFor(activeRank);

  const isCurrentUser = (rowName: string) =>
    rowName === user.name || rowName === `@${user.username}`;

  const livePoints = live.byRank(activeRank);
  const pointRows = live.hasData ? livePoints : pointUsers;
  const taskRows = live.hasData
    ? live.byTasks().map((p) => ({
        name: p.name,
        tasks: p.tasks,
        photo_url: p.photo_url,
        first_name: p.first_name,
        username: p.username,
      }))
    : LEADERBOARD_TASKS;
  const referralRows = live.hasData
    ? live.byReferrals().map((p) => ({
        name: p.name,
        referrals: p.referrals,
        photo_url: p.photo_url,
        first_name: p.first_name,
        username: p.username,
      }))
    : LEADERBOARD_REFERRALS;

  const tabs = [
    { key: "points", label: "POINT RANK" },
    { key: "tasks", label: "TASK RANK" },
    { key: "referrals", label: "REFERRAL RANK" },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Global Ranking</h1>
        <p className="text-sm text-muted-foreground">
          7 ranks, sorted by total points.
        </p>
      </div>

      {/* Founder feature */}
      <section className="glass glow-purple flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 border-2" style={{ borderColor: "#CCFF00" }}>
            <img
              src="/azox/azad-bashqali.jpg"
              alt="Azad Bashqali"
              className="size-full rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <AvatarFallback className="bg-primary/20 font-bold text-foreground">
              AB
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Crown className="size-4 text-gold" aria-hidden="true" />
              <p className="text-sm font-bold">Azad Bashqali</p>
            </div>
            <p className="text-xs text-muted-foreground">Founder — AZOX Token</p>
          </div>
        </div>
        <Link
          to="/about"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
          style={{
            background: "#CCFF00",
            color: "#000",
            boxShadow: "0 0 12px rgba(204,255,0,0.4)",
          }}
        >
          VIEW PROFILE
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      {/* Leaderboard type tabs */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                isActive
                  ? "border-transparent text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={isActive ? { backgroundColor: ACTIVE_TAB_COLOR } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "points" && (
        <>
          {/* Rank tabs */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {RANK_ORDER.map((key) => {
              const isActive = key === activeRank;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveRank(key)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    isActive
                      ? "border-transparent text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  style={isActive ? { backgroundColor: rankColor(key) } : undefined}
                >
                  {key}
                </button>
              );
            })}
          </div>

          {/* Points table */}
          <section className="glass rounded-2xl p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <h2 className="text-sm font-bold" style={{ color: rankColor(activeRank) }}>
                {activeRank}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {activeThreshold === 0
                  ? "Starter"
                  : `+${formatPoints(activeThreshold)}`}
              </span>
            </div>
            <ul className="flex flex-col">
              {pointRows.map((u) => (
                <LeaderboardRow
                  key={u.name}
                  position={u.position}
                  name={u.name}
                  value={formatPoints(u.points)}
                  photoUrl={u.photo_url ?? undefined}
                  firstName={u.first_name ?? undefined}
                  username={u.username ?? undefined}
                />
              ))}
            </ul>
          </section>
        </>
      )}

      {activeTab === "tasks" && (
        <section className="glass rounded-2xl p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-sm font-bold" style={{ color: ACTIVE_TAB_COLOR }}>
              TASK RANK
            </h2>
            <span className="text-[11px] text-muted-foreground">Total tasks</span>
          </div>
          <ul className="flex flex-col">
            {taskRows.map((u, i) => (
              <LeaderboardRow
                key={u.name}
                position={i + 1}
                name={u.name}
                value={u.tasks.toLocaleString("en-US")}
                photoUrl={u.photo_url ?? undefined}
                firstName={u.first_name ?? undefined}
                username={u.username ?? undefined}
              />
            ))}
          </ul>
        </section>
      )}

      {activeTab === "referrals" && (
        <section className="glass rounded-2xl p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-sm font-bold" style={{ color: ACTIVE_TAB_COLOR }}>
              REFERRAL RANK
            </h2>
            <span className="text-[11px] text-muted-foreground">Total referrals</span>
          </div>
          <ul className="flex flex-col">
            {referralRows.map((u, i) => (
              <LeaderboardRow
                key={u.name}
                position={i + 1}
                name={u.name}
                value={u.referrals.toLocaleString("en-US")}
                photoUrl={u.photo_url ?? undefined}
                firstName={u.first_name ?? undefined}
                username={u.username ?? undefined}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LeaderboardRow({
  position,
  name,
  value,
  photoUrl,
  firstName,
  username,
}: {
  position: number;
  name: string;
  value: string;
  photoUrl?: string | undefined;
  firstName?: string | undefined;
  username?: string | undefined;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/40">
      <span
        className={cn(
          "w-5 text-center text-sm font-bold tabular-nums",
          position === 1 ? "text-gold" : "text-muted-foreground",
        )}
      >
        {position}
      </span>
      <Avatar className="size-9">
        {photoUrl ? (
          <AvatarImage
            src={photoUrl}
            alt={firstName ?? username ?? "User"}
          />
        ) : null}
        <AvatarFallback className="bg-secondary text-xs font-semibold">
          {(firstName?.[0] ?? username?.[0] ?? "?").toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <span className="text-sm font-bold tabular-nums text-gold">{value}</span>
    </li>
  );
}
