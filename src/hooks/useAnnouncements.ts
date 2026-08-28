import { useCallback, useEffect, useState } from "react";
import { externalSupabase as supabase } from "@/integrations/external-supabase/client";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

const LAST_SEEN_KEY = "azox_last_announcement";

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (cancelled || error || !data) return;
      const rows = data as Announcement[];
      setAnnouncements(rows);
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      if (rows.length > 0 && rows[0]!.created_at !== lastSeen) setHasNew(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback(() => {
    const first = announcements[0];
    if (!first) return;
    localStorage.setItem(LAST_SEEN_KEY, first.created_at);
    setHasNew(false);
  }, [announcements]);

  return { announcements, hasNew, markSeen };
}
