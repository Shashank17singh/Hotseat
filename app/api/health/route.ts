import { hasServerKey, isMock } from "@/lib/server/llm";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ serverKey: hasServerKey(), mock: isMock() });
}
