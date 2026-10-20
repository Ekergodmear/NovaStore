import { Injectable } from '@nestjs/common';
import { Prisma } from '@novastore/database';
import type { AdminCategoryResponse, AppCategoryResponse } from '@novastore/types';
import type { CreateCategoryInput, UpdateCategoryInput } from '@novastore/validation';
import type { AuthUser } from '../auth/auth-user';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { categorySelect, toAdminCategoryResponse, toCategoryResponse } from './app.mapper';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Danh mục đang hiển thị (công khai và cho developer chọn). */
  async listActive(): Promise<AppCategoryResponse[]> {
    const rows = await this.prisma.appCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      select: categorySelect,
    });
    return rows.map(toCategoryResponse);
  }

  async adminList(): Promise<AdminCategoryResponse[]> {
    const rows = await this.prisma.appCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      select: { ...categorySelect, _count: { select: { apps: true } } },
    });
    return rows.map((row) => toAdminCategoryResponse(row, row._count.apps));
  }

  /**
   * App chỉ được gán danh mục tồn tại và đang hiển thị. Gọi trong transaction tạo/sửa app;
   * `FOR SHARE` để admin không ẩn/xóa danh mục giữa lúc kiểm tra và ghi.
   */
  async assertAssignable(tx: Prisma.TransactionClient, categoryId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM app_categories WHERE id = ${categoryId}::uuid AND is_active FOR SHARE`;
    if (rows.length === 0) {
      throw ApiException.badRequest('INVALID_CATEGORY', 'Invalid category', {
        detail: 'Danh mục không tồn tại hoặc đã bị ẩn',
        errors: [{ path: 'categoryId', message: 'Danh mục không hợp lệ' }],
      });
    }
  }

  async create(
    actor: AuthUser,
    input: CreateCategoryInput,
    context: AuditContext,
  ): Promise<AdminCategoryResponse> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.appCategory.create({
          data: {
            slug: input.slug,
            nameVi: input.nameVi,
            nameEn: input.nameEn,
            icon: input.icon ?? null,
            sortOrder: input.sortOrder ?? 0,
          },
          select: categorySelect,
        });
        await this.audit.record(
          {
            actor,
            action: 'category.create',
            targetType: 'app_category',
            targetId: created.id,
            after: pickCategory(created),
            context,
          },
          tx,
        );
        return created;
      });
      return toAdminCategoryResponse(row, 0);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw ApiException.conflict('CATEGORY_SLUG_TAKEN', 'Slug danh mục đã tồn tại');
      }
      throw error;
    }
  }

  async update(
    actor: AuthUser,
    id: string,
    input: UpdateCategoryInput,
    context: AuditContext,
  ): Promise<AdminCategoryResponse> {
    const { row, appCount } = await this.prisma.$transaction(async (tx) => {
      const before = await tx.appCategory.findUnique({ where: { id }, select: categorySelect });
      if (!before) throw categoryNotFound();
      const after = await tx.appCategory.update({
        where: { id },
        data: {
          ...(input.nameVi !== undefined && { nameVi: input.nameVi }),
          ...(input.nameEn !== undefined && { nameEn: input.nameEn }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        select: categorySelect,
      });
      await this.audit.record(
        {
          actor,
          action: 'category.update',
          targetType: 'app_category',
          targetId: id,
          before: pickCategory(before),
          after: pickCategory(after),
          context,
        },
        tx,
      );
      return { row: after, appCount: await tx.app.count({ where: { categoryId: id } }) };
    });
    return toAdminCategoryResponse(row, appCount);
  }

  /** Chỉ xóa danh mục chưa có app nào; đang dùng thì ẩn bằng `isActive: false`. */
  async delete(actor: AuthUser, id: string, context: AuditContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Khóa danh mục để không có app nào được gán vào giữa lúc đếm và xóa.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM app_categories WHERE id = ${id}::uuid FOR UPDATE`;
      if (locked.length === 0) throw categoryNotFound();
      const before = await tx.appCategory.findUniqueOrThrow({
        where: { id },
        select: categorySelect,
      });
      const appCount = await tx.app.count({ where: { categoryId: id } });
      if (appCount > 0) {
        throw ApiException.conflict(
          'CATEGORY_IN_USE',
          `Danh mục đang có ${appCount} ứng dụng; hãy ẩn (isActive: false) thay vì xóa`,
        );
      }
      await tx.appCategory.delete({ where: { id } });
      await this.audit.record(
        {
          actor,
          action: 'category.delete',
          targetType: 'app_category',
          targetId: id,
          before: pickCategory(before),
          context,
        },
        tx,
      );
    });
  }
}

function pickCategory(row: {
  slug: string;
  nameVi: string;
  nameEn: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    slug: row.slug,
    nameVi: row.nameVi,
    nameEn: row.nameEn,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function categoryNotFound() {
  return ApiException.notFound('Không tìm thấy danh mục');
}
