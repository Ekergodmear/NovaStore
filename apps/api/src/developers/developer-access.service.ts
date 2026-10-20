import { Injectable } from '@nestjs/common';
import type { Prisma } from '@novastore/database';
import type { DeveloperCapabilities, DeveloperMemberRole, DeveloperStatus } from '@novastore/types';
import type { AuthUser } from '../auth/auth-user';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Developer mà request hiện tại đại diện. Luôn được resolve phía server từ user đã
 * xác thực (JWT → users → developer_members); không bao giờ lấy từ body/query/header.
 */
export interface DeveloperContext {
  userId: string;
  accountId: string;
  memberRole: DeveloperMemberRole;
  status: DeveloperStatus;
}

/**
 * - `read`: xem tài nguyên riêng của account (mọi trạng thái, để developer thấy lý do bị khóa).
 * - `manage_profile`: sửa hồ sơ (pending/active; owner hoặc admin của account).
 * - `publish`: thao tác phát hành ứng dụng — Phase 2B+ (chỉ active; mọi vai trò thành viên).
 */
export type DeveloperCapability = 'read' | 'manage_profile' | 'publish';

const PROFILE_EDITABLE_STATUSES: readonly DeveloperStatus[] = ['pending', 'active'];
const PUBLISH_STATUSES: readonly DeveloperStatus[] = ['active'];
const PROFILE_MANAGER_ROLES: readonly DeveloperMemberRole[] = ['owner', 'admin'];

export function developerCapabilities(
  status: DeveloperStatus,
  memberRole: DeveloperMemberRole,
): DeveloperCapabilities {
  return {
    canManageProfile:
      PROFILE_EDITABLE_STATUSES.includes(status) && PROFILE_MANAGER_ROLES.includes(memberRole),
    canPublish: PUBLISH_STATUSES.includes(status),
  };
}

/** Trạng thái cho phép mutation theo capability, để lặp lại điều kiện trong câu WHERE. */
export function statusesFor(capability: Exclude<DeveloperCapability, 'read'>): DeveloperStatus[] {
  return capability === 'manage_profile' ? [...PROFILE_EDITABLE_STATUSES] : [...PUBLISH_STATUSES];
}

@Injectable()
export class DeveloperAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Developer account của user, hoặc null nếu chưa đăng ký. Luôn đọc DB mới nhất. */
  async resolve(
    userId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<DeveloperContext | null> {
    const membership = await db.developerMember.findUnique({
      where: { userId },
      select: { memberRole: true, developerAccount: { select: { id: true, status: true } } },
    });
    if (!membership) return null;
    return {
      userId,
      accountId: membership.developerAccount.id,
      memberRole: membership.memberRole,
      status: membership.developerAccount.status,
    };
  }

  /** Resolve và kiểm tra capability; ném 403 với mã lỗi cụ thể nếu không đủ quyền. */
  async require(user: AuthUser, capability: DeveloperCapability): Promise<DeveloperContext> {
    const context = await this.resolve(user.id);
    if (!context) {
      throw ApiException.forbidden(
        'DEVELOPER_ACCOUNT_REQUIRED',
        'Cần đăng ký tài khoản nhà phát triển trước',
      );
    }
    assertCapability(context, capability);
    return context;
  }

  /**
   * Chính sách 404 thống nhất: tài nguyên không tồn tại và tài nguyên của developer khác
   * trả cùng một phản hồi, không lộ sự tồn tại của dữ liệu riêng tư.
   */
  assertOwnsAccount(context: DeveloperContext, developerAccountId: string): void {
    if (context.accountId !== developerAccountId) {
      throw notFound();
    }
  }

  /** Điều kiện WHERE giới hạn truy vấn trong tài nguyên của developer hiện tại (Phase 2B+). */
  ownedWhere(context: DeveloperContext): { developerAccountId: string } {
    return { developerAccountId: context.accountId };
  }
}

export function assertCapability(context: DeveloperContext, capability: DeveloperCapability) {
  if (capability === 'read') return;

  if (!statusesFor(capability).includes(context.status)) {
    throw ApiException.forbidden(
      'DEVELOPER_ACCOUNT_NOT_ACTIVE',
      `Tài khoản nhà phát triển đang ở trạng thái "${context.status}" nên không thể thực hiện thao tác này`,
    );
  }
  if (capability === 'manage_profile' && !PROFILE_MANAGER_ROLES.includes(context.memberRole)) {
    throw ApiException.forbidden(
      'DEVELOPER_ROLE_INSUFFICIENT',
      'Chỉ owner hoặc admin của tài khoản nhà phát triển được sửa hồ sơ',
    );
  }
}

export function notFound(): ApiException {
  return ApiException.notFound('Không tìm thấy tài khoản nhà phát triển');
}
