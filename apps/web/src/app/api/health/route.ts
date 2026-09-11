import { loadConfig } from "../../../../../../packages/runtime/src/config.ts";
import { healthStatus } from "../../../../../../packages/contracts/src/health.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    loadConfig();
    return Response.json(healthStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ service: "web", status: "configuration_error" },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

