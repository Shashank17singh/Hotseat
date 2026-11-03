import { completeJson } from "@/lib/server/llm";
import { checkPrompt } from "@/lib/server/prompts";
import { aiRoute } from "@/lib/server/route";
import { CheckRequestSchema, CheckResultSchema } from "@/lib/types";

export const maxDuration = 60;

export const POST = aiRoute(async (request, { apiKey }) => {
  const body = CheckRequestSchema.parse(await request.json());
  return completeJson({
    task: "check",
    tier: "deep",
    ...checkPrompt(body),
    schema: CheckResultSchema,
    maxTokens: 2500,
    apiKey,
  });
});
