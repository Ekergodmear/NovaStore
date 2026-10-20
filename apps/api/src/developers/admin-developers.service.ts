import { Injectable } from '@nestjs/common';
import {
  DEVELOPER_STATUSES_ADMIN_ONLY,
  isDeveloperStatusTransitionAllowed,
  type AdminDeveloperResponse,
  type CursorPage,
  type DeveloperStatus,
} from '@novastore/types';
import type { AdminDeveloperListQuery, ChangeDeveloperStatusInput } from '@novastore/validation';
import type { AuthUser } from '../auth/auth-user';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { notFound } from './developer-access.service';
import { developerAccountSelect, toAdminDeveloperResponse } from './developer.mapper';

@Injectable()
export class AdminDevelopersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminDeveloperListQuery): Promise<CursorPage<AdminDeveloperResponse>> {
    const rows = await this.prisma.developerAccount.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      select: developerAccountSelect,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      data: page.map(toAdminDeveloperResponse),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(id: string): Promise<AdminDeveloperResponse> {
    const row = await this.prisma.developerAccount.findUnique({
      where: { id },
      select: developerAccountSelect,
    });
    if (!row) throw notFound();
    return toAdminDeveloperResponse(row);
  }

  /**
   * Đổi trạng thái theo bảng chuyển hợp lệ. Cập nhật có điều kiện `status = from`
   * (optimistic lock): hai staff thao tác cùng lúc thì chỉ một người thành công.
   */
  async changeStatus(
    actor: AuthUser,
    id: string,
    input: ChangeDeveloperStatusInput,
    context: AuditContext,
  ): Promise<AdminDeveloperResponse> {
    const to: DeveloperStatus = input.status;
    if (
      (DEVELOPER_STATUSES_ADMIN_ONLY as readonly DeveloperStatus[]).includes(to) &&
      !actor.roles.includes('admin')
    ) {
      throw ApiException.forbidden('FORBIDDEN', `Chỉ Admin được chuyển developer sang "${to}"`);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.developerAccount.findUnique({
        where: { id },
        select: { ...developerAccountSelect, members: { select: { userId: true } } },
      });
      if (!current) throw notFound();

      if (current.members.some((m) => m.userId === actor.id)) {
        throw ApiException.forbidden(
          'CONFLICT_OF_INTEREST',
          'Không thể duyệt hoặc đổi trạng thái tài khoản nhà phát triển mà bạn là thành viên',
        );
      }

      const from = current.status;
      if (!isDeveloperStatusTransitionAllowed(from, to)) {
        throw invalidTransition(from, to);
      }

      const { count } = await tx.developerAccount.updateMany({
        where: { id, status: from },
        data: { status: to, statusReason: input.reason ?? null, statusChangedAt: new Date() },
      });
      if (count === 0) {
        // Trạng thái đã bị người khác đổi giữa lúc đọc và ghi.
        throw invalidTransition(from, to);
      }

      const updated = await tx.developerAccount.findUniqueOrThrow({
        where: { id },
        select: developerAccountSelect,
      });
      await this.audit.record(
        {
          actor,
          action: 'developer.status.change',
          targetType: 'developer_account',
          targetId: id,
          before: { status: from, statusReason: current.statusReason },
          after: { status: updated.status, statusReason: updated.statusReason },
          context,
        },
        tx,
      );
      return updated;
    });

    return toAdminDeveloperResponse(row);
  }
}

function invalidTransition(from: DeveloperStatus, to: DeveloperStatus) {
  return ApiException.conflict(
    'INVALID_STATUS_TRANSITION',
    `Không thể chuyển developer từ "${from}" sang "${to}"`,
  );
}
