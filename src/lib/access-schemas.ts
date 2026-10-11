import { z } from "zod";

// Pure validators for the access gate server functions.
export const policyInput = z.object({ initData: z.string().min(1).max(8192) });

export const locationInput = z.object({
  initData: z.string().min(1).max(8192),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  horizontalAccuracy: z.number().finite().min(0).nullable().optional(),
});
