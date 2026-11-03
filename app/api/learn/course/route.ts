import { normalizeOutline } from "@/lib/learn";
import { aiRoute } from "@/lib/server/route";
import { writeOutline } from "@/lib/server/teach";
import { CourseRequestSchema } from "@/lib/types";

export const maxDuration = 60;

export const POST = aiRoute(async (request, { apiKey }) => {
  const body = CourseRequestSchema.parse(await request.json());
  return normalizeOutline(await writeOutline(body, apiKey), body.profile);
});
