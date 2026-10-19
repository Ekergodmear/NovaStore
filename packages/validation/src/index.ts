import { z } from 'zod';
import { DEVELOPER_MEMBER_ROLES, PLATFORM_ROLES } from '@novastore/types';

export { z };

/** Slug dùng trong URL: chữ thường, số, gạch ngang; 3–40 ký tự. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, 'Slug chỉ gồm a-z, 0-9 và dấu gạch ngang');

/** Android package name, ví dụ `vn.acme.notes`. */
export const packageNameSchema = z
  .string()
  .max(255)
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/,
    'Package name không hợp lệ (ví dụ: vn.acme.notes)',
  );

export const sha256HexSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'SHA-256 phải là 64 ký tự hex thường');

export const httpsUrlSchema = z.url({ protocol: /^https$/ });

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const platformRoleSchema = z.enum(PLATFORM_ROLES);
export const developerMemberRoleSchema = z.enum(DEVELOPER_MEMBER_ROLES);

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    avatarUrl: httpsUrlSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Cần ít nhất một trường để cập nhật' });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const createDeveloperSchema = z
  .object({
    slug: slugSchema,
    displayName: z.string().trim().min(2).max(60),
    contactEmail: z.email(),
    website: httpsUrlSchema.optional(),
    agreementVersion: z.string().min(1).max(20),
  })
  .strict();
export type CreateDeveloperInput = z.infer<typeof createDeveloperSchema>;
