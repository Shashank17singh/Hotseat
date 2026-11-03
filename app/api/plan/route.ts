import { completeJson } from "@/lib/server/llm";
import { planPrompt } from "@/lib/server/prompts";
import { aiRoute } from "@/lib/server/route";
import { PlanRequestSchema, PlanSchema } from "@/lib/types";

export const maxDuration = 60;

export const POST = aiRoute(async (request, { apiKey }) => {
  const { config, profile, avoid, focus } = PlanRequestSchema.parse(await request.json());
  const plan = await completeJson({
    task: "plan",
    tier: "deep",
    ...planPrompt(config, profile, avoid, focus),
    schema: PlanSchema,
    maxTokens: 3000,
    // Higher than the model default, so two interviews for the same role do not read alike.
    temperature: 0.9,
    apiKey,
  });
  const allowed = new Set(focus.map((skill) => skill.id));
  const questions = plan.questions
    .slice(0, config.questionCount)
    .map((question) => ({ ...question, skillId: question.skillId && allowed.has(question.skillId) ? question.skillId : undefined }));
  return { ...plan, questions };
});
