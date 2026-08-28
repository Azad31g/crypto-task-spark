import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export function useSupabaseTasks() {
  const [groups, setGroups] = useState<SocialTaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;

    (async () => {
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

        if (cancelled) return;

        if (err) {
          console.error("[useSupabaseTasks] Supabase error:", err);
          console.error("[useSupabaseTasks] Error details:", JSON.stringify(err));
          setError(err.message);
          setGroups([]);
          setLoading(false);
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

        setGroups(
          [...byPlatform.entries()].map(([platform, tasks]) => ({
            platform,
            ...groupMeta(platform),
            tasks,
          })),
        );
        setError(null);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        if (timedOut) {
          console.error("[useSupabaseTasks] Timeout after 5 seconds");
          setError("Timed out while loading tasks. Please try again.");
          setGroups([]);
          setLoading(false);
        } else {
          const message = e instanceof Error ? e.message : "Unknown error";
          console.error("[useSupabaseTasks] Fetch error:", e);
          setError(message);
          setGroups([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { groups, loading, error };
}
