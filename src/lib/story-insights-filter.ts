export type TimeOrder = "newest" | "oldest";

export function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").trim();
}

export function matchesPerson(
  person: { name: string; username: string | null },
  query: string,
): boolean {
  const needle = normalize(query).replace(/^@/, "").trim();
  return (
    !needle ||
    normalize(person.name).includes(needle) ||
    normalize((person.username ?? "").replace(/^@/, "")).includes(needle)
  );
}

export function sortByTime<T extends { time: string }>(list: readonly T[], order: TimeOrder): T[] {
  const timestamp = (time: string) => {
    const value = Date.parse(time);
    return Number.isFinite(value) ? value : 0;
  };
  return [...list].sort(
    (a, b) => (timestamp(a.time) - timestamp(b.time)) * (order === "oldest" ? 1 : -1),
  );
}
