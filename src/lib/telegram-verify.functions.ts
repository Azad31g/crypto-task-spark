import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  telegramId: z.number().int().positive(),
  chatUsername: z.string().min(1).max(64),
});

/**
 * Verifies that a Telegram user is a member of a public group/channel.
 * The bot token stays server-side (never shipped to the browser).
 */
export const verifyTelegramMembership = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) {
      // No bot token configured — use honor system (trust user opened the link)
      return { ok: true as const, member: true, status: "honor_system" };
    }

    try {
      const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${encodeURIComponent(
        data.chatUsername,
      )}&user_id=${data.telegramId}`;
      const res = await fetch(url);
      const body = (await res.json()) as {
        ok?: boolean;
        result?: { status?: string };
        description?: string;
      };

      if (!body.ok) {
        return {
          ok: false as const,
          member: false,
          error: body.description ?? "telegram_error",
        };
      }

      const status = body.result?.status ?? "";
      const member = ["member", "administrator", "creator"].includes(status);
      return { ok: true as const, member, status };
    } catch {
      return { ok: false as const, member: false, error: "request_failed" };
    }
  });
