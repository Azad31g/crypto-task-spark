import { useEffect, useSyncExternalStore } from "react";
import { externalSupabase as supabase } from "@/integrations/external-supabase/client";
console.log("[tasks] using URL:", "oevefjiajicjtbhqvglk");
import {
  SOCIAL_TASKS,
  type SocialTask,
  type SocialTaskGroup,
} from "@/lib/azox-data";

/** Supabase platform value -> display platform name used by the UI. */
export const PLATFORM_LABELS: Record<string, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  tiktok: "TikTok",
  threads: "Threads",
  x: "X (Twitter)",
  youtube: "YouTube",
  discord: "Discord",
};

type Platform =
  | "telegram"
  | "instagram"
  | "tiktok"
  | "threads"
  | "x"
  | "youtube"
  | "discord";

type TaskRow = {
  id: string;
  platform: Platform;
  title: string;
  url: string;
  points: number;
  status: string;
  sort_order: number;
  task_reward?: number | null;
};

/** Brand colors already defined for each platform in the static data. */
function groupMeta(label: string) {
  const existing = SOCIAL_TASKS.find((g) => g.platform === label);
  return {
    color: existing?.color ?? "#a3e635",
    ...(existing?.accent ? { accent: existing.accent } : {}),
  };
}

/** Telegram public group username, used for membership verification. */
function telegramChat(url: string): string | undefined {
  const m = url.match(/t\.me\/([A-Za-z0-9_]+)/);
  return m?.[1];
}

const TASKS_TTL_MS = 5 * 60 * 1000;

type TasksState = { groups: SocialTaskGroup[]; loading: boolean; error: string | null };

// Shared module-level cache: every hook instance shares one result and one
// in-flight request. Successful results are reused for TASKS_TTL_MS.
let tasksState: TasksState = { groups: [], loading: true, error: null };
const TASKS_SERVER_SNAPSHOT = tasksState;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const tasksListeners = new Set<() => void>();

function setTasks(next: TasksState) {
  tasksState = next;
  tasksListeners.forEach((l) => l());
}
function subscribeTasks(l: () => void) {
  tasksListeners.add(l);
  return () => void tasksListeners.delete(l);
}

async function fetchTasks(): Promise<void> {
  let timedOut = false;
  console.log("[tasks] starting fetch...");
  console.log("[useSupabaseTasks] fetching from:", "oevefjiajicjtbhqvglk");

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      reject(new Error("Request timed out after 5 seconds"));
    }, 5000);
  });

  try {
    const { data, error: err } = await Promise.race([
      (supabase as any)
        .from("tasks")
        .select("id, platform, title, url, points, status, sort_order, task_reward")
        .eq("status", "active")
        .order("platform", { ascending: true })
        .order("sort_order", { ascending: true }),
      timeout,
    ]);

    if (err) {
      console.error("[useSupabaseTasks] Supabase error:", err);
      console.error("[useSupabaseTasks] Error details:", JSON.stringify(err));
      setTasks({ groups: [], loading: false, error: err.message });
      return;
    }

    console.log("[useSupabaseTasks] data received:", data?.length, "tasks");

    const byPlatform = new Map<string, SocialTask[]>();
    for (const row of (data ?? []) as unknown as TaskRow[]) {
      const label = PLATFORM_LABELS[row.platform] ?? row.platform;
      const chat = telegramChat(row.url);
      const task: SocialTask = {
        id: row.id,
        platform: label,
        label: row.title,
        points: row.points,
        url: row.url,
        taskReward: row.task_reward ?? 0,
        ...(row.platform === "telegram" && chat ? { verifyChat: chat } : {}),
      };
      const list = byPlatform.get(label) ?? [];
      list.push(task);
      byPlatform.set(label, list);
    }

    fetchedAt = Date.now();
    setTasks({
      groups: [...byPlatform.entries()].map(([platform, tasks]) => ({
        platform,
        ...groupMeta(platform),
        tasks,
      })),
      loading: false,
      error: null,
    });
  } catch (e) {
    if (timedOut) {
      console.error("[useSupabaseTasks] Timeout after 5 seconds");
      setTasks({
        groups: [],
        loading: false,
        error: "Timed out while loading tasks. Please try again.",
      });
    } else {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("[useSupabaseTasks] Fetch error:", e);
      setTasks({ groups: [], loading: false, error: message });
    }
  }
}

/** Fetches unless a fresh (< TTL) successful result exists; shares in-flight. */
function ensureTasks(): void {
  if (inflight) return;
  if (fetchedAt && Date.now() - fetchedAt < TASKS_TTL_MS) return;
  inflight = fetchTasks().finally(() => {
    inflight = null;
  });
}

export function useSupabaseTasks() {
  const s = useSyncExternalStore(
    subscribeTasks,
    () => tasksState,
    () => TASKS_SERVER_SNAPSHOT,
  );
  useEffect(ensureTasks, []);
  return { groups: s.groups, loading: s.loading, error: s.error };
}
