import type { DeveloperMembershipSummary, PlatformRole } from '@novastore/types';
import type { Request } from 'express';

/** Người dùng đã xác thực, gắn vào request bởi AuthGuard. Quyền lấy từ Postgres, không từ JWT. */
export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'active' | 'suspended' | 'deleted';
  /** Luôn chứa 'user'. */
  roles: PlatformRole[];
  developerAccounts: DeveloperMembershipSummary[];
  aal: 'aal1' | 'aal2';
}

export type AuthenticatedRequest = Request & { id?: string; user?: AuthUser };
