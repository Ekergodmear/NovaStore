import { Injectable } from '@nestjs/common';
import { Prisma } from '@novastore/database';
import {
  CURRENT_DEVELOPER_AGREEMENT_VERSION,
  type DeveloperAccountResponse,
  type DeveloperStatusResponse,
  type PublicDeveloperProfile,
} from '@novastore/types';
import type { CreateDeveloperInput, UpdateDeveloperInput } from '@novastore/validation';
import type { AuthUser } from '../auth/auth-user';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCapability,
  DeveloperAccessService,
  notFound,
  statusesFor,
  type DeveloperContext,
} from './developer-access.service';
import {
  developerAccountSelect,
  toDeveloperAccountResponse,
  toDeveloperStatusResponse,
  toPublicDeveloperProfile,
} from './developer.mapper';

@Injectable()
export class DevelopersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DeveloperAccessService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Đăng ký developer account cho user hiện tại. Account luôn bắt đầu ở `pending`;
   * người gọi trở thành owner. Unique `developer_members.user_id` và `slug` chặn trùng
   * ở tầng DB nên an toàn cả khi nhiều request đồng thời.
   */
  async register(
    user: AuthUser,
    input: CreateDeveloperInput,
    context: AuditContext,
  ): Promise<DeveloperAccountResponse> {
    if (input.agreementVersion !== CURRENT_DEVELOPER_AGREEMENT_VERSION) {
      throw ApiException.badRequest('AGREEMENT_VERSION_MISMATCH', 'Agreement version mismatch', {
        detail: `Cần chấp nhận Developer Agreement phiên bản ${CURRENT_DEVELOPER_AGREEMENT_VERSION}`,
      });
    }
    if (await this.access.resolve(user.id)) {
      throw accountExists();
    }

    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const created = await tx.developerAccount.create({
          data: {
            slug: input.slug,
            displayName: input.displayName,
            contactEmail: input.contactEmail,
            website: input.website ?? null,
            agreementVersion: input.agreementVersion,
            agreementAcceptedAt: new Date(),
            members: { create: { userId: user.id, memberRole: 'owner' } },
          },
          select: developerAccountSelect,
        });
        await this.audit.record(
          {
            actor: user,
            action: 'developer.register',
            targetType: 'developer_account',
            targetId: created.id,
            after: {
              slug: created.slug,
              displayName: created.displayName,
              contactEmail: created.contactEmail,
              website: created.website,
              status: created.status,
              agreementVersion: created.agreementVersion,
            },
            context,
          },
          tx,
        );
        return created;
      });
      return toDeveloperAccountResponse(account, 'owner');
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  async getAccount(developer: DeveloperContext): Promise<DeveloperAccountResponse> {
    const row = await this.findAccount(developer.accountId);
    return toDeveloperAccountResponse(row, developer.memberRole);
  }

  async getStatus(developer: DeveloperContext): Promise<DeveloperStatusResponse> {
    const row = await this.findAccount(developer.accountId);
    return toDeveloperStatusResponse(row, developer.memberRole);
  }

  /**
   * Sửa hồ sơ. Guard đã kiểm capability, nhưng điều kiện trạng thái được lặp lại trong
   * WHERE để staff khóa tài khoản giữa chừng cũng không lọt (không có TOCTOU).
   */
  async updateProfile(
    user: AuthUser,
    developer: DeveloperContext,
    input: UpdateDeveloperInput,
    context: AuditContext,
  ): Promise<DeveloperAccountResponse> {
    assertCapability(developer, 'manage_profile');

    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.developerAccount.findUnique({
        where: { id: developer.accountId },
        select: developerAccountSelect,
      });
      if (!before) throw notFound();

      const { count } = await tx.developerAccount.updateMany({
        where: { id: developer.accountId, status: { in: statusesFor('manage_profile') } },
        data: {
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
          ...(input.website !== undefined && { website: input.website }),
        },
      });
      if (count === 0) {
        throw ApiException.forbidden(
          'DEVELOPER_ACCOUNT_NOT_ACTIVE',
          'Trạng thái tài khoản vừa thay đổi; không thể sửa hồ sơ',
        );
      }

      const after = await tx.developerAccount.findUniqueOrThrow({
        where: { id: developer.accountId },
        select: developerAccountSelect,
      });
      await this.audit.record(
        {
          actor: user,
          action: 'developer.update',
          targetType: 'developer_account',
          targetId: developer.accountId,
          before: pickProfile(before),
          after: pickProfile(after),
          context,
        },
        tx,
      );
      return after;
    });

    return toDeveloperAccountResponse(row, developer.memberRole);
  }

  /** Hồ sơ công khai: chỉ developer active; trạng thái khác trả 404 như không tồn tại. */
  async getPublicProfile(slug: string): Promise<PublicDeveloperProfile> {
    const row = await this.prisma.developerAccount.findFirst({
      where: { slug, status: 'active' },
      select: developerAccountSelect,
    });
    if (!row) throw notFound();
    return toPublicDeveloperProfile(row);
  }

  private async findAccount(id: string) {
    const row = await this.prisma.developerAccount.findUnique({
      where: { id },
      select: developerAccountSelect,
    });
    if (!row) throw notFound();
    return row;
  }
}

function pickProfile(row: { displayName: string; contactEmail: string; website: string | null }) {
  return { displayName: row.displayName, contactEmail: row.contactEmail, website: row.website };
}

function accountExists() {
  return ApiException.conflict('DEVELOPER_ACCOUNT_EXISTS', 'Bạn đã có tài khoản nhà phát triển');
}

/** Ánh xạ vi phạm unique (P2002) sang lỗi nghiệp vụ; lỗi khác giữ nguyên. */
function mapUniqueViolation(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return error;
  }
  const target = JSON.stringify(error.meta?.target ?? '');
  if (target.includes('slug')) {
    return ApiException.conflict('DEVELOPER_SLUG_TAKEN', 'Slug đã được sử dụng');
  }
  if (target.includes('user_id') || target.includes('userId')) {
    return accountExists();
  }
  return ApiException.conflict('CONFLICT', 'Dữ liệu bị trùng');
}
