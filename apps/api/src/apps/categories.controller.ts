import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AdminCategoryResponse, AppCategoryResponse } from '@novastore/types';
import {
  createCategorySchema,
  updateCategorySchema,
  uuidSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@novastore/validation';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { auditContextFrom } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApiJsonBody, ApiJsonResponses } from '../openapi/decorators';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Danh mục đang hiển thị' })
  @ApiJsonResponses(
    { status: 200, schema: 'AppCategoryList', description: 'Danh mục theo thứ tự hiển thị' },
    [],
  )
  list(): Promise<AppCategoryResponse[]> {
    return this.categories.listActive();
  }
}

/** Chỉ Admin (MFA bắt buộc khi REQUIRE_STAFF_MFA bật). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/categories')
@Roles('admin')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Mọi danh mục, kể cả đang ẩn, kèm số app' })
  @ApiJsonResponses(
    { status: 200, schema: 'AdminCategoryList', description: 'Danh mục' },
    [401, 403],
  )
  list(): Promise<AdminCategoryResponse[]> {
    return this.categories.adminList();
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo danh mục' })
  @ApiJsonBody('CreateCategoryRequest')
  @ApiJsonResponses(
    { status: 201, schema: 'AdminCategoryResponse', description: 'Danh mục vừa tạo' },
    [400, 401, 403, 409],
  )
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminCategoryResponse> {
    return this.categories.create(actor, body, auditContextFrom(request));
  }

  @Patch(':categoryId')
  @ApiOperation({ summary: 'Sửa / ẩn danh mục (slug không đổi được)' })
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  @ApiJsonBody('UpdateCategoryRequest')
  @ApiJsonResponses(
    { status: 200, schema: 'AdminCategoryResponse', description: 'Danh mục sau khi sửa' },
    [400, 401, 403, 404],
  )
  update(
    @CurrentUser() actor: AuthUser,
    @Param('categoryId', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminCategoryResponse> {
    return this.categories.update(actor, id, body, auditContextFrom(request));
  }

  @Delete(':categoryId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa danh mục chưa có app (đang dùng → 409, hãy ẩn)' })
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  @ApiJsonResponses({ status: 204, description: 'Đã xóa' }, [400, 401, 403, 404, 409])
  async remove(
    @CurrentUser() actor: AuthUser,
    @Param('categoryId', new ZodValidationPipe(uuidSchema)) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.categories.delete(actor, id, auditContextFrom(request));
  }
}
