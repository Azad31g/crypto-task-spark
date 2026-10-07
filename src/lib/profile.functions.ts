import { createServerFn } from "@tanstack/react-start";
// Verified-user reads of restricted tables; identity comes only from initData.
type In = { initData: string };
export const getMyUser = createServerFn({ method: "POST" })
  .inputValidator((input: In) => input)
  .handler(async ({ data }) => (await import("./profile.server")).readMyUser(data));
export const getMyWalletRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: In) => input)
  .handler(async ({ data }) => (await import("./profile.server")).readMyWalletRegistration(data));
export const getMyTaskCount = createServerFn({ method: "POST" })
  .inputValidator((input: In) => input)
  .handler(async ({ data }) => (await import("./profile.server")).readMyTaskCount(data));
export const getReferredUsers = createServerFn({ method: "POST" })
  .inputValidator((input: In) => input)
  .handler(async ({ data }) => (await import("./profile.server")).readReferredUsers(data));
