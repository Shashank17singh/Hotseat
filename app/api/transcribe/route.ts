import { ApiError } from "@/lib/server/errors";
import { transcribe } from "@/lib/server/llm";
import { aiRoute } from "@/lib/server/route";
import { LIMITS } from "@/lib/types";

export const maxDuration = 60;

export const POST = aiRoute(async (request, { apiKey }) => {
  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    throw new ApiError("invalid", "No audio was received.");
  }
  if (audio.size > LIMITS.audioBytes) {
    throw new ApiError("too_large", "That answer is too long to transcribe. Keep answers under 20 minutes.");
  }
  return { text: await transcribe(audio, apiKey) };
});
