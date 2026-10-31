import { completeJson } from "@/lib/server/llm";
import { ApiError } from "@/lib/server/errors";
import { profilePrompt } from "@/lib/server/prompts";
import { extractResumeText, prepareResumeText } from "@/lib/server/resume";
import { aiRoute } from "@/lib/server/route";
import { ProfileSchema } from "@/lib/types";

export const maxDuration = 60;

export const POST = aiRoute(async (request, { apiKey }) => {
  const form = await request.formData();
  const file = form.get("file");
  const pasted = form.get("text");

  let resume: { text: string; truncated: boolean };
  if (file instanceof File) resume = await extractResumeText(file);
  else if (typeof pasted === "string") resume = prepareResumeText(pasted);
  else throw new ApiError("invalid", "Attach a resume file or paste its text.");

  const profile = await completeJson({
    task: "profile",
    tier: "fast",
    ...profilePrompt(resume.text),
    schema: ProfileSchema,
    maxTokens: 2500,
    apiKey,
  });
  return { profile, truncated: resume.truncated };
});
