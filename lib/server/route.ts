import { ZodError } from "zod";
import { ApiError } from "./errors";
import { checkRateLimit } from "./rate-limit";

const DEFAULT_HOURLY_LIMIT = 60;

type Context = { apiKey?: string };

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function aiRoute(handler: (request: Request, context: Context) => Promise<unknown>) {
  return async (request: Request) => {
    try {
      const apiKey = request.headers.get("x-groq-key")?.trim() || undefined;
      // A visitor's own key spends their quota, so only the shared key is limited.
      if (!apiKey) {
        checkRateLimit(clientIp(request), Number(process.env.RATE_LIMIT_PER_HOUR) || DEFAULT_HOURLY_LIMIT);
      }
      return Response.json(await handler(request, { apiKey }));
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json(error.toBody(), { status: error.status });
      }
      if (error instanceof ZodError || error instanceof SyntaxError) {
        const invalid = new ApiError("invalid", "The request was not valid.");
        return Response.json(invalid.toBody(), { status: invalid.status });
      }
      console.error("Unhandled API error:", error instanceof Error ? error.message : "unknown");
      const unknown = new ApiError("unknown", "Something went wrong on the server.");
      return Response.json(unknown.toBody(), { status: unknown.status });
    }
  };
}
