import { useId, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, Eye, Heart, MessageCircle, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoryInsights } from "@/lib/stories.functions";
import { matchesPerson, normalize, sortByTime, type TimeOrder } from "@/lib/story-insights-filter";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insights: StoryInsights | null;
  error: boolean;
  onRetry: () => void;
};
const tabs = [
  {
    key: "viewers",
    count: "views",
    label: "Views",
    heading: "Viewers",
    search: "viewers",
    icon: Eye,
  },
  { key: "likers", count: "likes", label: "Likes", heading: "Likes", search: "likes", icon: Heart },
  {
    key: "comments",
    count: "comments",
    label: "Comments",
    heading: "Comments",
    search: "comments",
    icon: MessageCircle,
  },
] as const;
type Tab = (typeof tabs)[number]["key"];

// Local semantic tokens keep this scoped sheet independent of other AZOX surfaces.
const sheetStyles = `
.story-insights-panel {
  --insights-white: #ffffff;
  --insights-green: #ccff00;
  --insights-red: #ff4d6a;
  --insights-blue: #3b9bff;
  --insights-surface: #080c08;
  --insights-row: #10160e;
  color: var(--insights-white);
  background: linear-gradient(165deg, color-mix(in srgb, var(--insights-green) 4%, var(--insights-surface)), var(--insights-surface) 65%);
  border-color: color-mix(in srgb, var(--insights-green) 20%, transparent);
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
.story-insights-panel .insights-handle { background: color-mix(in srgb, var(--insights-white) 25%, transparent); }
.story-insights-panel .insights-muted { color: color-mix(in srgb, var(--insights-white) 55%, transparent); }
.story-insights-panel .insights-border { border-color: color-mix(in srgb, var(--insights-green) 15%, transparent); }
.story-insights-panel .insights-row { background: var(--insights-row); }
.story-insights-panel .insights-stat { --stat-color: var(--insights-green); border-color: color-mix(in srgb, var(--stat-color) 60%, transparent); background: var(--insights-row); box-shadow: inset 0 0 18px color-mix(in srgb, var(--stat-color) 8%, transparent); }
.story-insights-panel .insights-stat-likes { --stat-color: var(--insights-red); }
.story-insights-panel .insights-stat-comments { --stat-color: var(--insights-blue); }
.story-insights-panel .insights-stat-icon { color: var(--stat-color); }
.story-insights-panel .insights-tab { color: color-mix(in srgb, var(--insights-white) 70%, transparent); }
.story-insights-panel .insights-tab[aria-selected="true"] { background: var(--insights-green); color: var(--background); font-weight: 700; }
.story-insights-panel .insights-avatar { border-color: color-mix(in srgb, var(--insights-green) 70%, transparent); }
.story-insights-panel .insights-comment { color: color-mix(in srgb, var(--insights-white) 90%, transparent); }
.story-insights-panel .insights-search { color: var(--insights-white); }
.story-insights-panel .insights-search::placeholder { color: color-mix(in srgb, var(--insights-white) 45%, transparent); }
`;

export function StoryInsightsSheet({ open, onOpenChange, insights, error, onRetry }: Props) {
  const [active, setActive] = useState<Tab>("viewers");
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Record<Tab, TimeOrder>>({
    viewers: "newest",
    likers: "newest",
    comments: "newest",
  });
  const panelId = useId();
  const tab = tabs.find((item) => item.key === active) ?? tabs[0];
  const searching = Boolean(normalize(query).replace(/^@/, "").trim());
  const matches = useMemo(
    () => ({
      viewers: (insights?.viewers ?? []).filter((person) => matchesPerson(person, query)),
      likers: (insights?.likers ?? []).filter((person) => matchesPerson(person, query)),
      comments: (insights?.comments ?? []).filter((person) => matchesPerson(person, query)),
    }),
    [insights, query],
  );
  const rows = sortByTime(matches[active], orders[active]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <style>{sheetStyles}</style>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[110] bg-background/70" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="story-insights-panel fixed inset-x-0 bottom-0 z-[111] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl border outline-none"
          onKeyDown={(event) => {
            // Do not let nested dialog keys reach the story's navigation controls.
            event.stopPropagation();
          }}
        >
          <div className="shrink-0 px-4 pt-3 sm:px-6">
            <div className="insights-handle mx-auto mb-4 h-1 w-10 rounded-full" />
            <div className="mb-5 flex items-center justify-between gap-3">
              <DialogPrimitive.Title className="text-2xl font-bold">
                Story insights
              </DialogPrimitive.Title>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close insights"
                title="Close insights"
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </div>
            <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
              {tabs.map(({ count, label, icon: Icon }) => (
                <div
                  key={count}
                  className={`insights-stat insights-stat-${count} min-w-0 rounded-2xl border p-3 sm:p-4`}
                >
                  <Icon className="insights-stat-icon mb-2 size-5" />
                  <div className="insights-muted text-xs">{label}</div>
                  <div className="mt-1 text-2xl font-bold sm:text-3xl">
                    {insights?.counts[count] ?? "—"}
                  </div>
                </div>
              ))}
            </div>
            <div
              role="tablist"
              aria-label="Story engagement"
              className="insights-border mb-3 grid grid-cols-3 gap-1 rounded-full border p-1"
            >
              {tabs.map(({ key, count, label, icon: Icon }, index) => (
                <Button
                  key={key}
                  id={`${panelId}-${key}`}
                  role="tab"
                  aria-selected={active === key}
                  aria-controls={panelId}
                  tabIndex={active === key ? 0 : -1}
                  variant="ghost"
                  className="insights-tab h-10 min-w-0 gap-1 rounded-full px-1 text-[11px] sm:gap-2 sm:text-sm"
                  onClick={() => setActive(key)}
                  onKeyDown={(event) => {
                    let next: number | undefined;
                    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
                    if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
                    if (event.key === "Home") next = 0;
                    if (event.key === "End") next = tabs.length - 1;
                    if (next === undefined) return;
                    event.preventDefault();
                    const target = tabs[next];
                    if (!target) return;
                    setActive(target.key);
                    document.getElementById(`${panelId}-${target.key}`)?.focus();
                  }}
                >
                  <Icon className="size-3 sm:size-4" />
                  <span>
                    {label} ({searching ? matches[key].length : (insights?.counts[count] ?? 0)})
                  </span>
                </Button>
              ))}
            </div>
            <div className="relative mb-5">
              <Search className="insights-muted pointer-events-none absolute left-4 top-3.5 size-4" />
              <Input
                className="insights-search insights-border insights-row h-11 rounded-full pl-10 pr-12"
                aria-label={`Search ${tab.search} by name or username`}
                placeholder={`Search ${tab.search} by name or username…`}
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                maxLength={60}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 rounded-full"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X />
                </Button>
              )}
            </div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="min-w-0 text-xl font-bold">
                {tab.heading} ({rows.length})
              </h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="insights-muted shrink-0 gap-1 px-1"
                    aria-label="Sort results"
                  >
                    {orders[active] === "newest" ? "Newest first" : "Oldest first"}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[112]">
                  <DropdownMenuRadioGroup
                    value={orders[active]}
                    onValueChange={(value) => {
                      if (value === "newest" || value === "oldest")
                        setOrders((current) => ({ ...current, [active]: value }));
                    }}
                  >
                    <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${panelId}-${active}`}
            className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-6"
          >
            {error ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-10">
                <p className="insights-muted">Insights unavailable</p>
                <Button onClick={onRetry}>Retry</Button>
              </div>
            ) : !insights ? (
              <div role="status" aria-label="Loading insights" className="space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="insights-border insights-row flex gap-3 rounded-2xl border p-3"
                  >
                    <Skeleton className="size-12 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2 py-1">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !rows.length ? (
              <p role="status" className="insights-muted break-words py-10 text-center">
                {searching ? `No results for “${query}”` : `No ${tab.search} yet`}
              </p>
            ) : (
              <ul className="space-y-3">
                {rows.map((person, index) => (
                  <li
                    key={`${person.time}-${index}`}
                    className="insights-border insights-row flex items-start gap-3 rounded-2xl border p-3"
                  >
                    <Avatar className="insights-avatar size-12 border">
                      <AvatarImage
                        src={person.photoUrl ?? undefined}
                        alt={person.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="insights-row text-sm font-bold">
                        {person.name
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((word) => Array.from(word)[0] ?? "")
                          .join("")
                          .toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold" title={person.name}>
                        {person.name}
                      </p>
                      {person.username && (
                        <p className="insights-muted truncate text-sm">
                          @{person.username.replace(/^@/, "")}
                        </p>
                      )}
                      {active === "comments" && person.body !== undefined && (
                        <p className="insights-comment mt-2 whitespace-pre-wrap break-words text-sm">
                          {person.body}
                        </p>
                      )}
                    </div>
                    <time
                      dateTime={person.time}
                      className="insights-muted w-24 shrink-0 text-right text-[11px] sm:w-36 sm:text-xs"
                    >
                      {new Date(person.time).toLocaleString("en-US", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
