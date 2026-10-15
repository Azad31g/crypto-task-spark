import { describe, expect, it } from "vitest";
import { pickClientIp } from "./client-ip";

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name] ?? null };
}

describe("pickClientIp", () => {
  it("prefers cf-connecting-ip", () => {
    expect(
      pickClientIp(
        headers({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("takes the first entry of x-forwarded-for", () => {
    expect(
      pickClientIp(headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1, 192.168.0.1" })),
    ).toBe("198.51.100.1");
  });

  it("strips a trailing port from IPv4", () => {
    expect(pickClientIp(headers({ "x-real-ip": "203.0.113.9:51234" }))).toBe("203.0.113.9");
  });

  it("accepts bracketed IPv6", () => {
    expect(pickClientIp(headers({ "x-real-ip": "[2001:db8::1]:443" }))).toBe("2001:db8::1");
  });

  it("accepts plain IPv6", () => {
    expect(pickClientIp(headers({ "cf-connecting-ip": "2001:db8::ff" }))).toBe("2001:db8::ff");
  });

  it("returns null for garbage", () => {
    expect(pickClientIp(headers({ "cf-connecting-ip": "not-an-ip" }))).toBeNull();
    expect(pickClientIp(headers({ "cf-connecting-ip": "999.999.999.999" }))).toBeNull();
  });

  it("returns null for empty or oversized values", () => {
    expect(pickClientIp(headers({ "cf-connecting-ip": "   " }))).toBeNull();
    expect(pickClientIp(headers({ "cf-connecting-ip": "1".repeat(46) }))).toBeNull();
  });

  it("returns null when there are no headers", () => {
    expect(pickClientIp(headers({}))).toBeNull();
  });
});
