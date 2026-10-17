import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { QUESTIONS_PER_DAY } from "./rewards";

const questionSchema = z.object({
  question: z.string().refine((value) => value.trim().length > 0),
  options: z.array(z.string().refine((value) => value.trim().length > 0)).length(5),
  correct: z.number().int().min(0).max(4),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export type DailyQuestion = z.infer<typeof questionSchema>;

type DailyQuestionsResult =
  | { ok: true; questions: DailyQuestion[] }
  | { ok: false; error: "unavailable" };

function unavailable(reason: string): DailyQuestionsResult {
  console.error(`[question-day] ${reason}`);
  return { ok: false, error: "unavailable" };
}

export const getDailyQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ initData: z.string().min(1).max(8192) }).parse(data),
  )
  .handler(async ({ data }): Promise<DailyQuestionsResult> => {
    try {
      const { verifyTelegramInitData } = await import("./telegram-auth.server");
      const verified = await verifyTelegramInitData(data.initData);
      if (!verified.ok) return unavailable(`verification failed: ${verified.error}`);

      const { db, utcDay } = await import("./azox-secure.server");
      const { data: result, error } = await db().rpc("get_daily_questions", {
        p_day: utcDay(),
      });
      if (error) return unavailable("daily questions RPC failed");

      const parsed = z
        .object({ questions: z.array(questionSchema).length(QUESTIONS_PER_DAY) })
        .safeParse(result);
      if (!parsed.success) return unavailable("invalid or unavailable daily questions");
      return { ok: true, questions: parsed.data.questions };
    } catch {
      return unavailable("daily questions request failed");
    }
  });