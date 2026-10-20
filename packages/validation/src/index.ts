import { z } from 'zod';
import {
  APP_LOCALES,
  APP_STATUSES,
  CONTENT_RATINGS,
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

// ───────────────────────────── App management (Phase 2B) ─────────────────────────────

/**
 * Tiền tố package name không cho developer tự khai báo: nền tảng Android và một số
 * thương hiệu dễ bị mạo danh. Danh sách khởi đầu; xác minh quyền sở hữu là Phase 3.
 */
export const RESERVED_PACKAGE_ROOTS = [
  'android',
  'androidx',
  'com.android',
  'com.google',
  'com.facebook',
  'com.whatsapp',
  'com.instagram',
  'com.microsoft',
  'com.apple',
  'com.samsung',
  'com.zing.zalo',
  'com.novastore',
  'vn.novastore',
] as const;

/** `true` nếu package trùng hoặc nằm dưới một root dành riêng (không phân biệt hoa thường). */
export function isReservedPackageName(packageName: string): boolean {
  const name = packageName.toLowerCase();
  return RESERVED_PACKAGE_ROOTS.some((root) => name === root || name.startsWith(`${root}.`));
}

const appTitleSchema = z.string().trim().min(2).max(50);
const appShortDescriptionSchema = z.string().trim().min(10).max(80);
const appFullDescriptionSchema = z.string().trim().min(20).max(4000);
const optionalHttpsUrl = httpsUrlSchema.max(2048);

/**
 * `.strict()` chặn mass assignment: developerAccountId, status, slug, id, rating…
 * đều bị từ chối. Chủ sở hữu luôn là developer hiện tại (resolve phía server).
 */
export const createAppSchema = z
  .object({
    packageName: packageNameSchema,
    title: appTitleSchema,
    shortDescription: appShortDescriptionSchema,
    fullDescription: appFullDescriptionSchema,
    categoryId: uuidSchema,
    supportEmail: z.email().max(254),
    supportUrl: optionalHttpsUrl.optional(),
    privacyPolicyUrl: optionalHttpsUrl.optional(),
    contentRating: z.enum(CONTENT_RATINGS).optional(),
    containsAds: z.boolean().optional(),
    defaultLocale: z.enum(APP_LOCALES).optional(),
  })
  .strict();
export type CreateAppInput = z.infer<typeof createAppSchema>;

/** Chỉ metadata; packageName, status, chủ sở hữu và slug không sửa được. */
export const updateAppSchema = z
  .object({
    title: appTitleSchema.optional(),
    shortDescription: appShortDescriptionSchema.optional(),
    fullDescription: appFullDescriptionSchema.optional(),
    categoryId: uuidSchema.optional(),
    supportEmail: z.email().max(254).optional(),
    supportUrl: optionalHttpsUrl.nullable().optional(),
    privacyPolicyUrl: optionalHttpsUrl.nullable().optional(),
    contentRating: z.enum(CONTENT_RATINGS).optional(),
    containsAds: z.boolean().optional(),
    defaultLocale: z.enum(APP_LOCALES).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Cần ít nhất một trường để cập nhật' });
export type UpdateAppInput = z.infer<typeof updateAppSchema>;

export const appStatusSchema = z.enum(APP_STATUSES);

export const developerAppListQuerySchema = z
  .object({
    status: appStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: uuidSchema.optional(),
  })
  .strict();
export type DeveloperAppListQuery = z.infer<typeof developerAppListQuerySchema>;

const categoryNameSchema = z.string().trim().min(2).max(60);
const categoryIconSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/, 'Icon là tên biểu tượng: a-z, 0-9, gạch ngang');

export const createCategorySchema = z
  .object({
    slug: slugSchema,
    nameVi: categoryNameSchema,
    nameEn: categoryNameSchema,
    icon: categoryIconSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/** Slug danh mục không sửa được (đang nằm trong URL công khai). */
export const updateCategorySchema = z
  .object({
    nameVi: categoryNameSchema.optional(),
    nameEn: categoryNameSchema.optional(),
    icon: categoryIconSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Cần ít nhất một trường để cập nhật' });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
