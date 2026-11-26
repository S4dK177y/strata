import { NextResponse } from "next/server";
import { HealthResponseSchema } from "@strata/api-contract";

export async function GET() {
  const payload = HealthResponseSchema.parse({
    status: "ok",
    app: "strata",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(payload, { status: 200 });
}
