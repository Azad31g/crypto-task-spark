import { useEffect, useState } from "react";
import { Copy, Check, Users, Coins, Zap, Trophy, ChevronRight, Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useAzox } from "@/components/azox/app-provider";
import { AzoxFooter } from "@/components/azox/footer";
import { RANKS, formatPoints, nextRank as getNextRank } from "@/lib/azox-data";
import { syncTasksDone, referralLinkFor } from "@/lib/azox-backend";
import { getTelegramUser } from "@/lib/telegram";

export function ProfilePage() {
  const { user, dbUser, points, rank, completedTasks, referrals } = useAzox();

  const [copied, setCopied] = useState(false);
  const [tasksDone, setTasksDone] = useState(0);
  const tgUser = getTelegramUser();
  const displayName = tgUser
    ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || tgUser.username || "AZOX Player"
    : user.name;
  const displayUsername = tgUser?.username ? `@${tgUser.username}` : `@${user.username}`;
  const displayPhoto = tgUser?.photo_url ?? user.photoUrl;
  const referral = dbUser
    ? referralLinkFor(dbUser.referral_code ?? user.username)
    : user.referralLink;
  const rankLabel = dbUser?.rank ?? rank.key;
  const nextRank = getNextRank(points);

  // user_tasks is the single source of truth for the completed-task count.
  useEffect(() => {
    if (!tgUser?.id) return;
    let cancelled = false;
    void syncTasksDone().then((count) => {
      if (!cancelled) setTasksDone(count);
    });
    return () => {
      cancelled = true;
    };
  }, [tgUser?.id, completedTasks.size]);


  const progress = nextRank
    ? Math.min(
        100,
        ((points - rank.threshold) / (nextRank.threshold - rank.threshold)) *
          100,
      )
    : 100;


  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referral);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const share = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(referral)}&text=${encodeURIComponent("Join AZOX and start earning points!")}`;
    window.open(url, "_blank");
  };

  const stats = [
    { label: "Total Points", value: formatPoints(points), icon: Coins },
    { label: "Current Rank", value: rankLabel, icon: Trophy },
    { label: "Tasks Done", value: String(tasksDone), icon: Zap },
    { label: "Referrals", value: String(referrals), icon: Users },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Identity */}
      <section className="glass glow-purple flex items-center gap-3 rounded-2xl p-4">
        <Avatar className="size-14 border border-accent/40">
          {displayPhoto && <AvatarImage src={displayPhoto} alt={displayName} />}
          <AvatarFallback className="bg-accent/15 text-lg font-bold text-accent">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {displayUsername} · joined {user.joinedAt}
          </p>
        </div>
        <span
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{ color: rank.color, borderColor: rank.color }}
        >
          {rank.key}
        </span>
      </section>

      <Link
        to="/airdrop"
        className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{ background: "#0d0d0d", border: "1px solid #FF7A18" }}
      >
        <span className="flex items-center gap-3">
          <span style={{ fontSize: 28 }} aria-hidden="true">🪂</span>
          <span className="block">
            <span
              className="block text-[15px] font-bold"
              style={{ color: "#FF7A18" }}
            >
              AZOX Airdrop
            </span>
            <span className="block text-xs" style={{ color: "#666" }}>
              Register your wallet to qualify
            </span>
          </span>
        </span>
        <ChevronRight className="size-5" style={{ color: "#FF7A18" }} aria-hidden="true" />
      </Link>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          const body = (
            <>
              <Icon className="size-4 text-accent" aria-hidden="true" />
              <p className="mt-2 text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </>
          );
          if (s.label === "Referrals") {
            return (
              <Link
                key={s.label}
                to="/referrals"
                className="glass block rounded-2xl p-4 text-left"
              >
                {body}
              </Link>
            );
          }
          return (
            <div key={s.label} className="glass rounded-2xl p-4">
              {body}
            </div>
          );
        })}
      </section>

      {/* Rank progress */}
      <section className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold" style={{ color: rank.color }}>
            {rank.key}
          </span>
          {nextRank ? (
            <span className="text-muted-foreground">
              {formatPoints(nextRank.threshold - points)} to{" "}
              <span style={{ color: nextRank.color }}>{nextRank.key}</span>
            </span>
          ) : (
            <span className="text-gold">Max rank reached</span>
          )}
        </div>
        <Progress value={progress} className="h-2 bg-secondary" />
      </section>

      {/* Referral */}
      <section className="glass rounded-2xl p-4">
        <p className="text-sm font-bold">Your referral link</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Invite friends and earn bonus points together.
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            {referral}
          </code>
          <Button
            onClick={copy}
            className="rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent/90"
          >
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            onClick={share}
            variant="outline"
            className="rounded-xl border-accent/50 font-semibold text-accent"
          >
            <Share2 className="size-4" aria-hidden="true" />
            Share
          </Button>
        </div>
      </section>

      {/* All ranks */}
      <section className="glass rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-bold">Rank ladder</h2>
        <ul className="flex flex-col gap-2">
          {RANKS.map((r) => (
            <li
              key={r.key}
              className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs"
            >
              <span className="font-semibold" style={{ color: r.color }}>
                {r.key}
              </span>
              <span className="text-muted-foreground">
                {formatPoints(r.threshold)}+ · {r.pointsPerFinger}/finger
              </span>
            </li>
          ))}
        </ul>
      </section>

      <AzoxFooter variant="profile" />
    </div>
  );
}
