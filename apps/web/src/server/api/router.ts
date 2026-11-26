import { OpenAPIHono } from "@hono/zod-openapi";
import type { ApiEnv } from "./types";

export const AUTH_SECURITY: Array<Record<string, string[]>> = [
  { bearerAuth: [] },
  { cookieAuth: [] },
];

export function createSubRouter() {
  return new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: result.error.issues,
          },
          400
        );
      }
      return undefined;
    },
  });
}
