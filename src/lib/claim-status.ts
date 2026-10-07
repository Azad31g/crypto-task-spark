// Pure mapping: atomic DB RPC status -> server function response.
export type RpcClaimStatus = {
  status: string;
  points: number;
  rank: string | null;
  unitsPaid?: number;
  clipped?: boolean;
};
export type ClaimMapped =
  | { ok: true; granted: boolean; points: number; rank: string | null }
  | { ok: false; error: "cooldown" | "capped" | "server_error" };

export function mapClaimStatus(r: RpcClaimStatus): ClaimMapped {
  switch (r.status) {
    case "granted":
      return { ok: true, granted: true, points: r.points, rank: r.rank };
    case "duplicate":
      return { ok: true, granted: false, points: r.points, rank: r.rank };
    case "cooldown":
      return { ok: false, error: "cooldown" };
    case "capped":
      return { ok: false, error: "capped" };
    default:
      return { ok: false, error: "server_error" };
  }
}

/** Parses the RPC json; null when malformed. */
export function parseRpcStatus(data: unknown): RpcClaimStatus | null {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row || typeof row !== "object" || typeof row["status"] !== "string") return null;
  const points = Number(row["points"]);
  const out: RpcClaimStatus = {
    status: row["status"],
    points: Number.isFinite(points) ? points : 0,
    rank: typeof row["rank"] === "string" ? row["rank"] : null,
  };
  const paid = Number(row["units_paid"]);
  if (row["units_paid"] != null && Number.isFinite(paid)) out.unitsPaid = paid;
  if (typeof row["clipped"] === "boolean") out.clipped = row["clipped"];
  return out;
}
