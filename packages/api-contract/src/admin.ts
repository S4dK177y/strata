import { IsoDateTimeSchema, z } from "./common";
import { AdminTelemetrySchema, FeatureFlagSchema, InviteCodeSchema } from "./entities";

export const AdminTelemetryResponseSchema = z
  .object({
    telemetry: AdminTelemetrySchema,
  })
  .openapi("AdminTelemetryResponse");
export type AdminTelemetryResponse = z.infer<typeof AdminTelemetryResponseSchema>;

export const InviteCodeListResponseSchema = z
  .object({
    invites: z.array(InviteCodeSchema),
  })
  .openapi("InviteCodeListResponse");
export type InviteCodeListResponse = z.infer<typeof InviteCodeListResponseSchema>;

export const InviteCodeResponseSchema = z
  .object({
    invite: InviteCodeSchema,
  })
  .openapi("InviteCodeResponse");
export type InviteCodeResponse = z.infer<typeof InviteCodeResponseSchema>;

export const CreateInviteCodeRequestSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(4)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, "Invite code may only contain letters, digits, hyphens, and underscores")
      .optional(),
    max_uses: z.int().min(1).max(10000).default(1),
    expires_at: IsoDateTimeSchema.nullable().optional(),
    note: z.string().trim().max(240).nullable().optional(),
    is_active: z.boolean().default(true),
  })
  .openapi("CreateInviteCodeRequest");
export type CreateInviteCodeRequest = z.infer<typeof CreateInviteCodeRequestSchema>;

export const UpdateInviteCodeRequestSchema = z
  .object({
    max_uses: z.int().min(1).max(10000).optional(),
    expires_at: IsoDateTimeSchema.nullable().optional(),
    note: z.string().trim().max(240).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("UpdateInviteCodeRequest");
export type UpdateInviteCodeRequest = z.infer<typeof UpdateInviteCodeRequestSchema>;

export const DeletedInviteResponseSchema = z
  .object({
    id: z.uuid(),
    deleted: z.literal(true),
  })
  .openapi("DeletedInviteResponse");
export type DeletedInviteResponse = z.infer<typeof DeletedInviteResponseSchema>;

export const FeatureFlagKeyParamSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .openapi({
      param: { name: "key", in: "path" },
      example: "registration_invite_only",
    }),
});

export const AdminFeatureFlagsResponseSchema = z
  .object({
    flags: z.array(FeatureFlagSchema),
  })
  .openapi("AdminFeatureFlagsResponse");
export type AdminFeatureFlagsResponse = z.infer<typeof AdminFeatureFlagsResponseSchema>;

export const UpdateFeatureFlagRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    admin_preview: z.boolean().optional(),
    starts_at: IsoDateTimeSchema.nullable().optional(),
    ends_at: IsoDateTimeSchema.nullable().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("UpdateFeatureFlagRequest");
export type UpdateFeatureFlagRequest = z.infer<typeof UpdateFeatureFlagRequestSchema>;

export const FeatureFlagResponseSchema = z
  .object({
    flag: FeatureFlagSchema,
  })
  .openapi("FeatureFlagResponse");
export type FeatureFlagResponse = z.infer<typeof FeatureFlagResponseSchema>;
