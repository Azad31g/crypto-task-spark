import { describe, expect, it } from "vitest";
import { decideGate, type GpsPolicy } from "./access-gate";
import { locationInput } from "./access-schemas";

const P = (gps: GpsPolicy["gps"], banned = false): GpsPolicy => ({ banned, gps });
const LOC = [true, false, null] as const;

describe("decideGate", () => {
  it("fails open without policy", () => {
    for (const s of [true, false]) for (const l of LOC)
      expect(decideGate({ policy: null, supported: s, locationOk: l })).toBe("allow");
  });
  it("banned wins over every mode", () => {
    for (const g of ["off", "optional", "required"] as const)
      for (const s of [true, false]) for (const l of LOC)
        expect(decideGate({ policy: P(g, true), supported: s, locationOk: l })).toBe("banned");
  });
  it("off and optional always allow", () => {
    for (const g of ["off", "optional"] as const)
      for (const s of [true, false]) for (const l of LOC)
        expect(decideGate({ policy: P(g), supported: s, locationOk: l })).toBe("allow");
  });
  it("required: unsupported allows", () => {
    for (const l of LOC)
      expect(decideGate({ policy: P("required"), supported: false, locationOk: l })).toBe("allow");
  });
  it("required + supported follows location", () => {
    const d = (l: boolean | null) => decideGate({ policy: P("required"), supported: true, locationOk: l });
    expect(d(true)).toBe("allow");
    expect(d(null)).toBe("locating");
    expect(d(false)).toBe("blocked");
  });
});

describe("locationInput", () => {
  const base = { initData: "x", latitude: 10, longitude: 20 };
  it("accepts valid values", () => {
    expect(locationInput.safeParse(base).success).toBe(true);
    expect(locationInput.safeParse({ ...base, horizontalAccuracy: null }).success).toBe(true);
    expect(locationInput.safeParse({ ...base, latitude: -90, longitude: 180, horizontalAccuracy: 0 }).success).toBe(true);
  });
  it("rejects bad values", () => {
    for (const bad of [
      { latitude: 91 }, { latitude: -90.1 }, { longitude: 181 }, { longitude: -181 },
      { latitude: NaN }, { longitude: Infinity }, { horizontalAccuracy: -1 },
      { horizontalAccuracy: Infinity }, { initData: "" },
    ])
      expect(locationInput.safeParse({ ...base, ...bad }).success).toBe(false);
  });
});
