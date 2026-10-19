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

export const APP_STATUSES = ['draft', 'in_review', 'published', 'unlisted', 'removed'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const DEVELOPER_MEMBER_ROLES = ['owner', 'admin', 'editor'] as const;
export type DeveloperMemberRole = (typeof DEVELOPER_MEMBER_ROLES)[number];

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
