import { createServerFn } from "@tanstack/react-start";
// Identity comes only from verified initData; validation happens in access.server.
type PolicyIn = { initData: string };
type LocIn = {
  initData: string;
  latitude: number;
  longitude: number;
  horizontalAccuracy?: number | null;
};
export const getAccessPolicy = createServerFn({ method: "POST" })
  .inputValidator((input: PolicyIn) => input)
  .handler(async ({ data }) => (await import("./access.server")).readAccessPolicy(data));
export const submitLocation = createServerFn({ method: "POST" })
  .inputValidator((input: LocIn) => input)
  .handler(async ({ data }) => (await import("./access.server")).writeLocation(data));
