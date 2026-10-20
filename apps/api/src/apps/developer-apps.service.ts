import { Injectable } from '@nestjs/common';
import { Prisma } from '@novastore/database';
import {
  APP_EDITABLE_STATUSES,
  isAppDeveloperTransitionAllowed,
  type AppStatus,
  type CursorPage,
  type DeveloperAppResponse,
  type DeveloperAppSummary,
} from '@novastore/types';
import {
  isReservedPackageName,
  type CreateAppInput,
  type DeveloperAppListQuery,
  type UpdateAppInput,
} from '@novastore/validation';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../auth/auth-user';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ApiException } from '../common/api-exception';
import {
  assertCapability,
  DeveloperAccessService,
  type DeveloperContext,
} from '../developers/developer-access.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  developerAppSelect,
  toDeveloperAppResponse,
  toDeveloperAppSummary,
  type DeveloperAppRow,
} from './app.mapper';
import { CategoriesService } from './categories.service';

const SLUG_ATTEMPTS = 3;

/**
 * Quản lý app của developer hiện tại. Mọi truy vấn đi qua `ownedWhere(context)`:
 * app của developer khác không bao giờ được đọc hay ghi, và trả 404 như không tồn tại.
 */
@Injectable()
export class DeveloperAppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DeveloperAccessService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  async create(
    user: AuthUser,
    developer: DeveloperContext,
    input: CreateAppInput,
    context: AuditContext,
  ): Promise<DeveloperAppResponse> {
    if (isReservedPackageName(input.packageName)) {
      throw ApiException.badRequest('PACKAGE_NAME_RESERVED', 'Package name reserved', {
        detail: 'Package name này thuộc không gian tên dành riêng',
        errors: [{ path: 'packageName', message: 'Package name dành riêng' }],
      });
    }

    for (let attempt = 0; ; attempt++) {
      const slug = appSlug(input.packageName, attempt);
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          await this.access.lockForMutation(tx, developer, 'publish');
          await this.categories.assertAssignable(tx, input.categoryId);

          const created = await tx.app.create({
            data: {
              // Chủ sở hữu luôn lấy từ context phía server, không bao giờ từ input.
              developerAccountId: developer.accountId,
              packageName: input.packageName,
              slug,
              title: input.title,
              shortDescription: input.shortDescription,
              fullDescription: input.fullDescription,
              categoryId: input.categoryId,
              supportEmail: input.supportEmail,
              supportUrl: input.supportUrl ?? null,
              privacyPolicyUrl: input.privacyPolicyUrl ?? null,
              contentRating: input.contentRating ?? 'everyone',
              containsAds: input.containsAds ?? false,
              defaultLocale: input.defaultLocale ?? 'vi',
            },
            select: developerAppSelect,
          });
          await this.audit.record(
            {
              actor: user,
              action: 'app.create',
              targetType: 'app',
              targetId: created.id,
              after: auditSnapshot(created),
              context,
            },
            tx,
          );
          return created;
        });
        return toDeveloperAppResponse(row, developer);
      } catch (error) {
        const target = uniqueViolationTarget(error);
        if (target?.includes('package_name') || target?.includes('packageName')) {
          throw ApiException.conflict('PACKAGE_NAME_TAKEN', 'Package name đã được đăng ký');
        }
        if (target?.includes('slug') && attempt + 1 < SLUG_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  async list(
    developer: DeveloperContext,
    query: DeveloperAppListQuery,
  ): Promise<CursorPage<DeveloperAppSummary>> {
    const rows = await this.prisma.app.findMany({
      where: {
        ...this.access.ownedWhere(developer),
        // Mặc định ẩn app đã archive; xem chúng bằng ?status=archived.
        status: query.status ?? { not: 'archived' },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      select: developerAppSelect,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      data: page.map(toDeveloperAppSummary),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(developer: DeveloperContext, appId: string): Promise<DeveloperAppResponse> {
    return toDeveloperAppResponse(await this.findOwned(developer, appId), developer);
  }

  /** Sửa metadata khi app còn `draft`. Kiểm sở hữu (404) trước capability (403). */
  async update(
    user: AuthUser,
    developer: DeveloperContext,
    appId: string,
    input: UpdateAppInput,
    context: AuditContext,
  ): Promise<DeveloperAppResponse> {
    const existing = await this.findOwned(developer, appId);
    assertCapability(developer, 'publish');
    assertEditable(existing.status);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.access.lockForMutation(tx, developer, 'publish');
      if (input.categoryId !== undefined) {
        await this.categories.assertAssignable(tx, input.categoryId);
      }

      const before = await tx.app.findFirst({
        where: { id: appId, ...this.access.ownedWhere(developer) },
        select: developerAppSelect,
      });
      if (!before) throw appNotFound();

      const { count } = await tx.app.updateMany({
        where: {
          id: appId,
          ...this.access.ownedWhere(developer),
          status: { in: [...APP_EDITABLE_STATUSES] },
        },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
          ...(input.fullDescription !== undefined && { fullDescription: input.fullDescription }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.supportEmail !== undefined && { supportEmail: input.supportEmail }),
          ...(input.supportUrl !== undefined && { supportUrl: input.supportUrl }),
          ...(input.privacyPolicyUrl !== undefined && { privacyPolicyUrl: input.privacyPolicyUrl }),
          ...(input.contentRating !== undefined && { contentRating: input.contentRating }),
          ...(input.containsAds !== undefined && { containsAds: input.containsAds }),
          ...(input.defaultLocale !== undefined && { defaultLocale: input.defaultLocale }),
        },
      });
      if (count === 0) {
        // Trạng thái vừa đổi giữa lúc đọc và ghi (vd. được gửi duyệt).
        throw ApiException.conflict('APP_NOT_EDITABLE', 'Ứng dụng không còn ở trạng thái draft');
      }

      const after = await tx.app.findFirstOrThrow({
        where: { id: appId, ...this.access.ownedWhere(developer) },
        select: developerAppSelect,
      });
      await this.audit.record(
        {
          actor: user,
          action: 'app.update',
          targetType: 'app',
          targetId: appId,
          before: auditSnapshot(before),
          after: auditSnapshot(after),
          context,
        },
        tx,
      );
      return after;
    });

    return toDeveloperAppResponse(row, developer);
  }

  /**
   * draft | rejected → archived. App chưa từng phát hành được giải phóng package name
   * (chuyển sang pending_package_name) để có thể đăng ký lại; app đã phát hành giữ tên.
   */
  async archive(
    user: AuthUser,
    developer: DeveloperContext,
    appId: string,
    context: AuditContext,
  ): Promise<DeveloperAppResponse> {
    const existing = await this.findOwned(developer, appId);
    assertCapability(developer, 'publish');
    assertArchivable(existing.status);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.access.lockForMutation(tx, developer, 'publish');
      const current = await tx.app.findFirst({
        where: { id: appId, ...this.access.ownedWhere(developer) },
        select: { ...developerAppSelect, currentReleaseId: true },
      });
      if (!current) throw appNotFound();
      assertArchivable(current.status);

      const everPublished =
        current.currentReleaseId !== null ||
        (await tx.appRelease.count({ where: { appId, publishedAt: { not: null } } })) > 0;
      const releasePackage = !everPublished && current.packageName !== null;

      const { count } = await tx.app.updateMany({
        where: { id: appId, ...this.access.ownedWhere(developer), status: current.status },
        data: {
          status: 'archived',
          ...(releasePackage && { packageName: null, pendingPackageName: current.packageName }),
        },
      });
      if (count === 0) throw invalidTransition(current.status);

      const after = await tx.app.findFirstOrThrow({
        where: { id: appId, ...this.access.ownedWhere(developer) },
        select: developerAppSelect,
      });
      await this.audit.record(
        {
          actor: user,
          action: 'app.archive',
          targetType: 'app',
          targetId: appId,
          before: { status: current.status, packageName: current.packageName },
          after: {
            status: after.status,
            packageName: after.packageName,
            packageReleased: releasePackage,
          },
          context,
        },
        tx,
      );
      return after;
    });

    return toDeveloperAppResponse(row, developer);
  }

  private async findOwned(developer: DeveloperContext, appId: string): Promise<DeveloperAppRow> {
    const row = await this.prisma.app.findFirst({
      where: { id: appId, ...this.access.ownedWhere(developer) },
      select: developerAppSelect,
    });
    if (!row) throw appNotFound();
    return row;
  }
}

/** vn.acme.notes → vn-acme-notes; lần thử sau thêm hậu tố ngẫu nhiên khi trùng slug. */
export function appSlug(packageName: string, attempt = 0): string {
  const base = packageName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
}

function auditSnapshot(row: DeveloperAppRow) {
  return {
    packageName: row.packageName,
    title: row.title,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    categoryId: row.category.id,
    supportEmail: row.supportEmail,
    supportUrl: row.supportUrl,
    privacyPolicyUrl: row.privacyPolicyUrl,
    contentRating: row.contentRating,
    containsAds: row.containsAds,
    defaultLocale: row.defaultLocale,
    status: row.status,
  };
}

function assertEditable(status: AppStatus) {
  if (!(APP_EDITABLE_STATUSES as readonly AppStatus[]).includes(status)) {
    throw ApiException.conflict(
      'APP_NOT_EDITABLE',
      `Chỉ sửa được metadata khi ứng dụng ở trạng thái draft (hiện tại: ${status})`,
    );
  }
}

function assertArchivable(status: AppStatus) {
  if (!isAppDeveloperTransitionAllowed(status, 'archived')) throw invalidTransition(status);
}

function invalidTransition(from: AppStatus) {
  return ApiException.conflict(
    'INVALID_APP_STATUS_TRANSITION',
    `Không thể chuyển ứng dụng từ "${from}" sang "archived"`,
  );
}

export function appNotFound() {
  return ApiException.notFound('Không tìm thấy ứng dụng');
}

function uniqueViolationTarget(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return JSON.stringify(error.meta?.target ?? '');
  }
  return null;
}
