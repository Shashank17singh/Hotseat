import { completeJson } from "@/lib/server/llm";
import { turnPrompt } from "@/lib/server/prompts";
import { aiRoute } from "@/lib/server/route";
import { TurnReplySchema, TurnRequestSchema } from "@/lib/types";

export const POST = aiRoute(async (request, { apiKey }) => {
  const body = TurnRequestSchema.parse(await request.json());
  return completeJson({
    task: "turn",
    tier: "fast",
    ...turnPrompt(body),
    schema: TurnReplySchema,
    maxTokens: 900,
    apiKey,
  });
});
