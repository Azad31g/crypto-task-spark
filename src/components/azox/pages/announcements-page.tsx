import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Megaphone, X } from "lucide-react";
import { useAnnouncements, type Announcement } from "@/hooks/useAnnouncements";

const READ_KEY = "azox_read_announcements";

function formatStamp(iso: string) {
  return new Date(iso)
    .toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(",", " •");
}

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AnnouncementsPage() {
  const { announcements, markSeen } = useAnnouncements();
  const [read, setRead] = useState<string[]>([]);
  const [open, setOpen] = useState<Announcement | null>(null);

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  useEffect(() => {
    setRead(readIds());
  }, []);

  const openAnnouncement = useCallback((a: Announcement) => {
    setOpen(a);
    setRead((prev) => {
      if (prev.includes(a.id)) return prev;
      const next = [...prev, a.id];
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const sorted = [...announcements].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="glass flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Back to home"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Megaphone className="size-5 text-gold" aria-hidden="true" />
          Announcements
        </h1>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No announcements yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => {
            const unread = !read.includes(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => openAnnouncement(a)}
                  className="relative w-full overflow-hidden rounded-3xl border border-border border-l-[3px] border-l-[#ff7a18] bg-card/70 px-4 py-3 text-left transition-colors duration-150 hover:bg-card active:scale-[0.99] active:bg-secondary"
                >
                  <span className="relative block min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold leading-tight text-foreground">
                        {a.title}
                      </span>
                      {unread && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-destructive"
                          aria-label="Unread"
                        />
                      )}
                    </span>
                    <span className="mt-1 block truncate text-[12px] leading-tight text-muted-foreground">
                      {a.message}
                    </span>
                    <span className="mt-1.5 block text-[11px] leading-tight text-muted-foreground/60">
                      {formatStamp(a.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-card sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-border p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Megaphone className="size-4 text-gold" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foreground">{open.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {formatStamp(open.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close announcement"
                className="glass flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {open.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
