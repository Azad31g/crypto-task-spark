export type GpsPolicy = { banned: boolean; gps: "off" | "optional" | "required" };
export type GateDecision = "allow" | "banned" | "locating" | "blocked";

export function decideGate(args: {
  policy: GpsPolicy | null;
  supported: boolean;
  locationOk: boolean | null;
}): GateDecision {
  const { policy, supported, locationOk } = args;
  if (!policy) return "allow";
  if (policy.banned) return "banned";
  if (policy.gps !== "required") return "allow";
  if (!supported) return "allow";
  if (locationOk === true) return "allow";
  if (locationOk === null) return "locating";
  return "blocked";
}
