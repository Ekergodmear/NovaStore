import {
  APP_STATUSES,
  CONTENT_RATINGS,
  DEVELOPER_MEMBER_ROLES,
  DEVELOPER_STATUSES,
  DEVELOPER_VERIFICATION_STATUSES,
  type AdminCategoryResponse,
  type AdminDeveloperResponse,
  type AppCategoryResponse,
  type DeveloperAppResponse,
  type DeveloperAppSummary,
  type DeveloperAccountResponse,
  type DeveloperStatusResponse,
  type ProblemDetails,
  type PublicDeveloperProfile,
} from '@novastore/types';
import {
  changeDeveloperStatusSchema,
  createAppSchema,
  createCategorySchema,
  createDeveloperSchema,
  updateAppSchema,
  updateCategorySchema,
  updateDeveloperSchema,
  z,
} from '@novastore/validation';

/**
 * Schema OpenAPI cho component. Request lấy trực tiếp từ Zod schema đang dùng để validate;
 * response được khai báo bằng Zod và kiểm tra khớp kiểu TypeScript ở compile time.
 */
const capabilities = z.object({ canManageProfile: z.boolean(), canPublish: z.boolean() });
const status = z.enum(DEVELOPER_STATUSES);
const isoDate = z.iso.datetime();

const developerAccountResponse = z.object({
  id: z.uuid(),
  slug: z.string(),
  displayName: z.string(),
  contactEmail: z.string(),
  website: z.string().nullable(),
  status,
  statusReason: z.string().nullable(),
  statusChangedAt: isoDate.nullable(),
  verificationStatus: z.enum(DEVELOPER_VERIFICATION_STATUSES),
  memberRole: z.enum(DEVELOPER_MEMBER_ROLES),
  agreementVersion: z.string(),
  agreementAcceptedAt: isoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
  capabilities,
});

const developerStatusResponse = z.object({
  developerAccountId: z.uuid(),
  status,
  statusReason: z.string().nullable(),
  statusChangedAt: isoDate.nullable(),
  capabilities,
});

const publicDeveloperProfile = z.object({
  slug: z.string(),
  displayName: z.string(),
  website: z.string().nullable(),
  verified: z.boolean(),
});

const adminDeveloperResponse = z.object({
  id: z.uuid(),
  slug: z.string(),
  displayName: z.string(),
  contactEmail: z.string(),
  website: z.string().nullable(),
  status,
  statusReason: z.string().nullable(),
  statusChangedAt: isoDate.nullable(),
  verificationStatus: z.enum(DEVELOPER_VERIFICATION_STATUSES),
  createdAt: isoDate,
  allowedTransitions: z.array(status),
});

const adminDeveloperPage = z.object({
  data: z.array(adminDeveloperResponse),
  nextCursor: z.uuid().nullable(),
});

const appStatus = z.enum(APP_STATUSES);

const developerAppResponse = z.object({
  id: z.uuid(),
  slug: z.string(),
  packageName: z.string().nullable(),
  packageNameReleased: z.boolean(),
  title: z.string(),
  shortDescription: z.string(),
  fullDescription: z.string(),
  category: z.object({ id: z.uuid(), slug: z.string(), nameVi: z.string(), nameEn: z.string() }),
  supportEmail: z.string().nullable(),
  supportUrl: z.string().nullable(),
  privacyPolicyUrl: z.string().nullable(),
  contentRating: z.enum(CONTENT_RATINGS),
  containsAds: z.boolean(),
  defaultLocale: z.string(),
  status: appStatus,
  createdAt: isoDate,
  updatedAt: isoDate,
  capabilities: z.object({ canEdit: z.boolean(), canArchive: z.boolean() }),
});

const developerAppSummary = z.object({
  id: z.uuid(),
  slug: z.string(),
  packageName: z.string().nullable(),
  title: z.string(),
  status: appStatus,
  categorySlug: z.string(),
  updatedAt: isoDate,
});

const developerAppPage = z.object({
  data: z.array(developerAppSummary),
  nextCursor: z.uuid().nullable(),
});

const appCategoryResponse = z.object({
  id: z.uuid(),
  slug: z.string(),
  nameVi: z.string(),
  nameEn: z.string(),
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
});

const adminCategoryResponse = appCategoryResponse.extend({
  isActive: z.boolean(),
  appCount: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const problemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

// Compile-time: schema tài liệu phải khớp đúng kiểu mà API trả về.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export type OpenApiSchemaChecks = [
  Expect<Equals<z.infer<typeof developerAccountResponse>, DeveloperAccountResponse>>,
  Expect<Equals<z.infer<typeof developerStatusResponse>, DeveloperStatusResponse>>,
  Expect<Equals<z.infer<typeof publicDeveloperProfile>, PublicDeveloperProfile>>,
  Expect<Equals<z.infer<typeof adminDeveloperResponse>, AdminDeveloperResponse>>,
  Expect<Equals<z.infer<typeof developerAppResponse>, DeveloperAppResponse>>,
  Expect<Equals<z.infer<typeof developerAppSummary>, DeveloperAppSummary>>,
  Expect<Equals<z.infer<typeof appCategoryResponse>, AppCategoryResponse>>,
  Expect<Equals<z.infer<typeof adminCategoryResponse>, AdminCategoryResponse>>,
  Expect<Equals<z.infer<typeof problemDetails>['code'], string>>,
  Expect<Equals<keyof z.infer<typeof problemDetails>, keyof ProblemDetails>>,
];

function toOpenApi(schema: z.ZodType, io: 'input' | 'output') {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io, unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
}

export const OPENAPI_COMPONENT_SCHEMAS = {
  CreateDeveloperRequest: toOpenApi(createDeveloperSchema, 'input'),
  UpdateDeveloperRequest: toOpenApi(updateDeveloperSchema, 'input'),
  ChangeDeveloperStatusRequest: toOpenApi(changeDeveloperStatusSchema, 'input'),
  DeveloperAccountResponse: toOpenApi(developerAccountResponse, 'output'),
  DeveloperStatusResponse: toOpenApi(developerStatusResponse, 'output'),
  PublicDeveloperProfile: toOpenApi(publicDeveloperProfile, 'output'),
  AdminDeveloperResponse: toOpenApi(adminDeveloperResponse, 'output'),
  AdminDeveloperPage: toOpenApi(adminDeveloperPage, 'output'),
  CreateAppRequest: toOpenApi(createAppSchema, 'input'),
  UpdateAppRequest: toOpenApi(updateAppSchema, 'input'),
  DeveloperAppResponse: toOpenApi(developerAppResponse, 'output'),
  DeveloperAppPage: toOpenApi(developerAppPage, 'output'),
  CreateCategoryRequest: toOpenApi(createCategorySchema, 'input'),
  UpdateCategoryRequest: toOpenApi(updateCategorySchema, 'input'),
  AppCategoryList: toOpenApi(z.array(appCategoryResponse), 'output'),
  AdminCategoryResponse: toOpenApi(adminCategoryResponse, 'output'),
  AdminCategoryList: toOpenApi(z.array(adminCategoryResponse), 'output'),
  ProblemDetails: toOpenApi(problemDetails, 'output'),
} as const;

export type OpenApiComponentName = keyof typeof OPENAPI_COMPONENT_SCHEMAS;

export const ref = (name: OpenApiComponentName) => ({ $ref: `#/components/schemas/${name}` });
