import { completeJson } from "@/lib/server/llm";
import { reportPrompt } from "@/lib/server/prompts";
import { aiRoute } from "@/lib/server/route";
import { buildReport } from "@/lib/score";
import { LlmReportSchema, ReportRequestSchema } from "@/lib/types";

export const maxDuration = 120;

export const POST = aiRoute(async (request, { apiKey }) => {
  const body = ReportRequestSchema.parse(await request.json());
  const llm = await completeJson({
    task: "report",
    tier: "deep",
    ...reportPrompt(body),
    schema: LlmReportSchema,
    maxTokens: 4000,
    apiKey,
  });
  return buildReport(llm, body.questions, body.turns);
});
