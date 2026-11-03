import { aiRoute } from "@/lib/server/route";
import { writeLesson } from "@/lib/server/teach";
import { LessonRequestSchema } from "@/lib/types";

export const maxDuration = 60;

export const POST = aiRoute(async (request, { apiKey }) => {
  const body = LessonRequestSchema.parse(await request.json());
  return writeLesson(body, apiKey);
});
