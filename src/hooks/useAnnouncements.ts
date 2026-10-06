import { useCallback, useEffect, useSyncExternalStore } from "react";
import { externalSupabase as supabase } from "@/integrations/external-supabase/client";
import { getAnnouncementReads, markAnnouncementsRead } from "@/lib/announcements.functions";
import { rawInitData } from "@/lib/azox-backend";
import { computeHasNew, computeIsUnread, legacyHasNew } from "@/lib/announcement-reads";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

const LAST_SEEN_KEY = "azox_last_announcement";
const READ_KEY = "azox_read_announcements";

type State = {
  announcements: Announcement[];
  /** "server" = per-Telegram-user state; "local" = legacy localStorage fallback. */
  mode: "server" | "local";
  seen: Set<string>;
  opened: Set<string>;
  lastSeen: string | null;
};

let state: State = {
  announcements: [],
  mode: "local",
  seen: new Set(),
  opened: new Set(),
  lastSeen: null,
};
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT = state;

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

function readLocalOpened(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

let loading: Promise<void> | null = null;
let started = false;

async function load() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- external table not in generated types
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return;
  const announcements = data as Announcement[];
  const initData = rawInitData();
  if (initData) {
    try {
      const reads = await getAnnouncementReads({ data: { initData } });
      if (reads.ok) {
        // Keep optimistic marks made in this session.
        setState({
          announcements,
          mode: "server",
          seen: new Set([...reads.seen, ...(state.mode === "server" ? state.seen : [])]),
          opened: new Set([...reads.opened, ...(state.mode === "server" ? state.opened : [])]),
        });
        return;
      }
    } catch {
      /* fall back below */
    }
  }
  let lastSeen: string | null = null;
  try {
    lastSeen = localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    /* ignore */
  }
  setState({ announcements, mode: "local", lastSeen, opened: readLocalOpened() });
}

function refresh() {
  if (!loading) loading = load().finally(() => (loading = null));
  return loading;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refresh();
  const focus = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  window.addEventListener("focus", focus);
  document.addEventListener("visibilitychange", focus);
}

function sendReads(payload: { seenIds?: string[]; openedIds?: string[] }) {
  const initData = rawInitData();
  if (!initData) return;
  markAnnouncementsRead({ data: { initData, ...payload } }).catch(() => {
    /* keep optimistic state */
  });
}

export function useAnnouncements() {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_SNAPSHOT,
  );
  useEffect(start, []);

  const ids = s.announcements.map((a) => a.id);
  const hasNew =
    s.mode === "server"
      ? computeHasNew(ids, s.seen)
      : legacyHasNew(s.announcements[0]?.created_at, s.lastSeen);

  const markSeen = useCallback(() => {
    const cur = state;
    if (!cur.announcements.length) return;
    if (cur.mode === "server") {
      const seenIds = cur.announcements.map((a) => a.id);
      setState({ seen: new Set([...cur.seen, ...seenIds]) });
      sendReads({ seenIds: seenIds.slice(0, 50) });
    } else {
      const first = cur.announcements[0]!.created_at;
      try {
        localStorage.setItem(LAST_SEEN_KEY, first);
      } catch {
        /* ignore */
      }
      setState({ lastSeen: first });
    }
  }, []);

  const markOpened = useCallback((id: string) => {
    const cur = state;
    if (cur.opened.has(id)) return;
    const opened = new Set(cur.opened).add(id);
    if (cur.mode === "server") {
      setState({ opened, seen: new Set(cur.seen).add(id) });
      sendReads({ openedIds: [id] });
    } else {
      try {
        localStorage.setItem(READ_KEY, JSON.stringify([...opened]));
      } catch {
        /* ignore */
      }
      setState({ opened });
    }
  }, []);

  const isUnread = useCallback((id: string) => computeIsUnread(id, s.opened), [s.opened]);

  return { announcements: s.announcements, hasNew, markSeen, isUnread, markOpened };
}
