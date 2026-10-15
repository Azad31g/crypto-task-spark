// Pure helper: pick the caller IP from request headers.
// Never throws; returns null when nothing valid is found.

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
// Strict-enough IPv6: hex groups with optional :: compression.
const IPV6 =
  /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^::$/;

function isValidIp(value: string): boolean {
  return IPV4.test(value) || IPV6.test(value);
}

function clean(raw: string | null): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v || v.length > 45) return null;
  // Strip surrounding [] for IPv6.
  if (v.startsWith("[") && v.includes("]")) {
    v = v.slice(1, v.indexOf("]"));
  } else {
    // Strip a trailing :port for IPv4 only.
    const m = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(v);
    const withoutPort = m?.[1];
    if (withoutPort) v = withoutPort;
  }
  return isValidIp(v) ? v : null;
}

export function pickClientIp(headers: {
  get(name: string): string | null;
}): string | null {
  try {
    const cf = clean(headers.get("cf-connecting-ip"));
    if (cf) return cf;
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const first = clean(xff.split(",")[0] ?? null);
      if (first) return first;
    }
    return clean(headers.get("x-real-ip"));
  } catch {
    return null;
  }
}
