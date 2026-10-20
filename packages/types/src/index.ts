/**
 * Kiểu dùng chung giữa API, worker và các frontend.
 * Giá trị enum phải khớp với enum trong packages/database/prisma/schema.prisma.
 */

export const PLATFORM_ROLES = ['user', 'moderator', 'admin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const STAFF_ROLES = ['moderator', 'admin'] as const satisfies readonly PlatformRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const RELEASE_STATUSES = [
  'draft',
  'uploading',
  'processing',
  'pending_review',
  'approved',
  'rejected',
  'published',
  'superseded',
  'revoked',
] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const APP_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'rejected',
  'suspended',
  'unlisted',
  'removed',
  'archived',
] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

/** Trạng thái app mà developer được sửa metadata. */
export const APP_EDITABLE_STATUSES = ['draft'] as const satisfies readonly AppStatus[];

/**
 * Chuyển trạng thái developer được tự thực hiện (Phase 2B: chỉ archive).
 * Gửi duyệt (draft → pending_review) là Phase 2C; duyệt/từ chối/tạm khóa do staff (Phase 3).
 */
export const APP_DEVELOPER_TRANSITIONS: Readonly<Record<AppStatus, readonly AppStatus[]>> = {
  draft: ['archived'],
  pending_review: [],
  published: [],
  rejected: ['archived'],
  suspended: [],
  unlisted: [],
  removed: [],
  archived: [],
};

export function isAppDeveloperTransitionAllowed(from: AppStatus, to: AppStatus): boolean {
  return APP_DEVELOPER_TRANSITIONS[from].includes(to);
}

export const CONTENT_RATINGS = ['everyone', 'teen', 'mature'] as const;
export type ContentRating = (typeof CONTENT_RATINGS)[number];

export const APP_LOCALES = ['vi', 'en'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEVELOPER_MEMBER_ROLES = ['owner', 'admin', 'editor'] as const;
export type DeveloperMemberRole = (typeof DEVELOPER_MEMBER_ROLES)[number];

export const DEVELOPER_STATUSES = ['pending', 'active', 'suspended', 'banned', 'rejected'] as const;
export type DeveloperStatus = (typeof DEVELOPER_STATUSES)[number];

export const DEVELOPER_VERIFICATION_STATUSES = [
  'unverified',
  'email_verified',
  'verified',
] as const;
export type DeveloperVerificationStatus = (typeof DEVELOPER_VERIFICATION_STATUSES)[number];

/** Phiên bản Developer Agreement hiện hành; đăng ký phải chấp nhận đúng phiên bản này. */
export const CURRENT_DEVELOPER_AGREEMENT_VERSION = '2026-10';

/**
 * Chuyển trạng thái hợp lệ cho developer account. Chỉ staff thực hiện; developer
 * không bao giờ tự đổi trạng thái. `banned` và `rejected` là trạng thái kết thúc.
 */
export const DEVELOPER_STATUS_TRANSITIONS: Readonly<
  Record<DeveloperStatus, readonly DeveloperStatus[]>
> = {
  pending: ['active', 'rejected'],
  active: ['suspended', 'banned'],
  suspended: ['active', 'banned'],
  banned: [],
  rejected: [],
};

/** Trạng thái đích bắt buộc kèm lý do (hiển thị cho developer). */
export const DEVELOPER_STATUSES_REQUIRING_REASON = [
  'rejected',
  'suspended',
  'banned',
] as const satisfies readonly DeveloperStatus[];

/** Trạng thái đích chỉ Admin (không phải Moderator) được đặt. */
export const DEVELOPER_STATUSES_ADMIN_ONLY = [
  'banned',
] as const satisfies readonly DeveloperStatus[];

export function isDeveloperStatusTransitionAllowed(
  from: DeveloperStatus,
  to: DeveloperStatus,
): boolean {
  return DEVELOPER_STATUS_TRANSITIONS[from].includes(to);
}

/** Mã lỗi máy đọc được, trả trong trường `code` của Problem Details. */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'MFA_REQUIRED',
  'ACCOUNT_SUSPENDED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  // Developer (Phase 2A)
  'DEVELOPER_ACCOUNT_REQUIRED',
  'DEVELOPER_ACCOUNT_EXISTS',
  'DEVELOPER_SLUG_TAKEN',
  'DEVELOPER_ACCOUNT_NOT_ACTIVE',
  'DEVELOPER_ROLE_INSUFFICIENT',
  'AGREEMENT_VERSION_MISMATCH',
  'INVALID_STATUS_TRANSITION',
  'CONFLICT_OF_INTEREST',
  // App management (Phase 2B)
  'PACKAGE_NAME_TAKEN',
  'PACKAGE_NAME_RESERVED',
  'INVALID_CATEGORY',
  'APP_NOT_EDITABLE',
  'INVALID_APP_STATUS_TRANSITION',
  'CATEGORY_SLUG_TAKEN',
  'CATEGORY_IN_USE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** RFC 9457 Problem Details. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode | (string & {});
  detail?: string;
  requestId?: string;
  errors?: Array<{ path: string; message: string }>;
}

export interface DeveloperMembershipSummary {
  developerAccountId: string;
  slug: string;
  displayName: string;
  memberRole: DeveloperMemberRole;
  status: DeveloperStatus;
}

/** Quyền hiệu lực của developer hiện tại, tính từ trạng thái + vai trò thành viên. */
export interface DeveloperCapabilities {
  canManageProfile: boolean;
  canPublish: boolean;
}

/** Hồ sơ developer riêng tư (chỉ thành viên của account xem được). */
export interface DeveloperAccountResponse {
  id: string;
  slug: string;
  displayName: string;
  contactEmail: string;
  website: string | null;
  status: DeveloperStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  verificationStatus: DeveloperVerificationStatus;
  memberRole: DeveloperMemberRole;
  agreementVersion: string;
  agreementAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
  capabilities: DeveloperCapabilities;
}

export interface DeveloperStatusResponse {
  developerAccountId: string;
  status: DeveloperStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  capabilities: DeveloperCapabilities;
}

/** Hồ sơ công khai: chỉ developer `active`, không có email liên hệ. */
export interface PublicDeveloperProfile {
  slug: string;
  displayName: string;
  website: string | null;
  verified: boolean;
}

/** Bản ghi developer cho staff (Admin Console). */
export interface AdminDeveloperResponse {
  id: string;
  slug: string;
  displayName: string;
  contactEmail: string;
  website: string | null;
  status: DeveloperStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  verificationStatus: DeveloperVerificationStatus;
  createdAt: string;
  allowedTransitions: DeveloperStatus[];
}

export interface MeResponse {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  roles: PlatformRole[];
  developerAccounts: DeveloperMembershipSummary[];
  mfa: { level: 'aal1' | 'aal2' };
}

export interface AdminDashboardResponse {
  pendingReview: number;
  submittedLast24h: number;
  openReports: number;
  activeDevelopers: number;
  approvalRate30d: number | null;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

/** Danh mục cho developer/công khai (chỉ danh mục đang hiển thị). */
export interface AppCategoryResponse {
  id: string;
  slug: string;
  nameVi: string;
  nameEn: string;
  icon: string | null;
  sortOrder: number;
}

/** Danh mục cho Admin: thêm trạng thái hiển thị và số app đang dùng. */
export interface AdminCategoryResponse extends AppCategoryResponse {
  isActive: boolean;
  appCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppCapabilities {
  canEdit: boolean;
  canArchive: boolean;
}

/** App của developer hiện tại (riêng tư). */
export interface DeveloperAppResponse {
  id: string;
  slug: string;
  /** Package name đã khai báo; app archived chưa từng phát hành thì tên đã được giải phóng. */
  packageName: string | null;
  packageNameReleased: boolean;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: { id: string; slug: string; nameVi: string; nameEn: string };
  supportEmail: string | null;
  supportUrl: string | null;
  privacyPolicyUrl: string | null;
  contentRating: ContentRating;
  containsAds: boolean;
  defaultLocale: string;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
  capabilities: AppCapabilities;
}

export interface DeveloperAppSummary {
  id: string;
  slug: string;
  packageName: string | null;
  title: string;
  status: AppStatus;
  categorySlug: string;
  updatedAt: string;
}
