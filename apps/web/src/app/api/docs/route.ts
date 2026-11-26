import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { handle } from "hono/vercel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const docsApp = new Hono();

docsApp.get(
  "/api/docs",
  Scalar({
    url: "/api/v1/openapi.json",
    pageTitle: "Strata API Docs",
  })
);

export const GET = handle(docsApp);
