import { IsoDateTimeSchema, z } from "./common";

export const AalLevelSchema = z.enum(["aal1", "aal2"]).openapi("AalLevel");
export type AalLevel = z.infer<typeof AalLevelSchema>;

export const SessionDeviceTypeSchema = z
  .enum(["desktop", "mobile", "tablet", "bot", "unknown"])
  .openapi("SessionDeviceType");
export type SessionDeviceType = z.infer<typeof SessionDeviceTypeSchema>;

export const ActiveSessionSchema = z
  .object({
    id: z.uuid(),
    is_current: z.boolean(),
    device_type: SessionDeviceTypeSchema,
    device_label: z.string(),
    browser: z.string().nullable(),
    os: z.string().nullable(),
    ip: z.string().nullable(),
    aal: AalLevelSchema.nullable(),
    created_at: IsoDateTimeSchema,
    last_active_at: IsoDateTimeSchema,
    not_after: IsoDateTimeSchema.nullable(),
  })
  .openapi("ActiveSession");
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

export const SessionListResponseSchema = z
  .object({
    sessions: z.array(ActiveSessionSchema),
    current_session_id: z.uuid().nullable(),
  })
  .openapi("SessionListResponse");
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

export const RevokeSessionResponseSchema = z
  .object({
    revoked: z.literal(true),
    session_id: z.uuid(),
    signed_out_current: z.boolean(),
  })
  .openapi("RevokeSessionResponse");
export type RevokeSessionResponse = z.infer<typeof RevokeSessionResponseSchema>;

export const RevokeOtherSessionsResponseSchema = z
  .object({
    revoked_count: z.int().nonnegative(),
  })
  .openapi("RevokeOtherSessionsResponse");
export type RevokeOtherSessionsResponse = z.infer<typeof RevokeOtherSessionsResponseSchema>;

export const DeleteAccountRequestSchema = z
  .object({
    password: z.string().min(1).max(256),
    totp_code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Must be a 6-digit authenticator code")
      .optional(),
  })
  .openapi("DeleteAccountRequest");
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

export const DeleteAccountResponseSchema = z
  .object({
    deleted: z.literal(true),
  })
  .openapi("DeleteAccountResponse");
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;
