import { z } from 'zod';
import {
  DEVELOPER_MEMBER_ROLES,
  DEVELOPER_STATUSES,
  DEVELOPER_STATUSES_REQUIRING_REASON,
  PLATFORM_ROLES,
} from '@novastore/types';

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

export const uuidSchema = z.uuid('Định danh không hợp lệ');

/** Slug dành riêng: trùng route (`/developers/me`) hoặc dễ bị dùng để mạo danh. */
export const RESERVED_DEVELOPER_SLUGS = [
  'me',
  'admin',
  'api',
  'app',
  'apps',
  'developer',
  'developers',
  'help',
  'moderator',
  'novastore',
  'official',
  'security',
  'support',
  'system',
] as const;

export const developerSlugSchema = slugSchema.refine(
  (slug) => !(RESERVED_DEVELOPER_SLUGS as readonly string[]).includes(slug),
  'Slug này được dành riêng',
);

const developerDisplayNameSchema = z.string().trim().min(2).max(60);
const contactEmailSchema = z.email().max(254);

/**
 * `.strict()`: mọi trường lạ (userId, ownerUserId, status, verificationStatus…)
 * đều bị từ chối, chặn mass assignment. Danh tính lấy từ JWT phía server.
 */
export const createDeveloperSchema = z
  .object({
    slug: developerSlugSchema,
    displayName: developerDisplayNameSchema,
    contactEmail: contactEmailSchema,
    website: httpsUrlSchema.max(2048).optional(),
    agreementVersion: z.string().min(1).max(20),
  })
  .strict();
export type CreateDeveloperInput = z.infer<typeof createDeveloperSchema>;

/** Chỉ các trường hồ sơ; slug, trạng thái, xác minh và thỏa thuận không sửa được. */
export const updateDeveloperSchema = z
  .object({
    displayName: developerDisplayNameSchema.optional(),
    contactEmail: contactEmailSchema.optional(),
    website: httpsUrlSchema.max(2048).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Cần ít nhất một trường để cập nhật' });
export type UpdateDeveloperInput = z.infer<typeof updateDeveloperSchema>;

export const developerStatusSchema = z.enum(DEVELOPER_STATUSES);

export const changeDeveloperStatusSchema = z
  .object({
    status: developerStatusSchema,
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict()
  .refine(
    (v) =>
      !(DEVELOPER_STATUSES_REQUIRING_REASON as readonly string[]).includes(v.status) ||
      v.reason !== undefined,
    { message: 'Cần lý do khi từ chối, tạm khóa hoặc cấm developer', path: ['reason'] },
  );
export type ChangeDeveloperStatusInput = z.infer<typeof changeDeveloperStatusSchema>;

export const adminDeveloperListQuerySchema = z
  .object({
    status: developerStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: uuidSchema.optional(),
  })
  .strict();
export type AdminDeveloperListQuery = z.infer<typeof adminDeveloperListQuerySchema>;
