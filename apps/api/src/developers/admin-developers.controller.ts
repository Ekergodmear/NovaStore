import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DEVELOPER_STATUSES, type AdminDeveloperResponse, type CursorPage } from '@novastore/types';
import {
  adminDeveloperListQuerySchema,
  changeDeveloperStatusSchema,
  uuidSchema,
  type AdminDeveloperListQuery,
  type ChangeDeveloperStatusInput,
} from '@novastore/validation';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { auditContextFrom } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApiJsonBody, ApiJsonResponses } from '../openapi/decorators';
import { AdminDevelopersService } from './admin-developers.service';

/** Moderator/Admin; RolesGuard toàn cục bắt buộc MFA (aal2) khi REQUIRE_STAFF_MFA bật. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/developers')
@Roles('moderator', 'admin')
export class AdminDevelopersController {
  constructor(private readonly admin: AdminDevelopersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách developer (lọc theo trạng thái, phân trang cursor)' })
  @ApiQuery({ name: 'status', required: false, enum: DEVELOPER_STATUSES })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiJsonResponses(
    { status: 200, schema: 'AdminDeveloperPage', description: 'Một trang developer' },
    [400, 401, 403],
  )
  list(
    @Query(new ZodValidationPipe(adminDeveloperListQuerySchema)) query: AdminDeveloperListQuery,
  ): Promise<CursorPage<AdminDeveloperResponse>> {
    return this.admin.list(query);
  }

  @Get(':developerAccountId')
  @ApiOperation({ summary: 'Chi tiết developer cho staff' })
  @ApiParam({ name: 'developerAccountId', format: 'uuid' })
  @ApiJsonResponses(
    { status: 200, schema: 'AdminDeveloperResponse', description: 'Developer' },
    [400, 401, 403, 404],
  )
  get(
    @Param('developerAccountId', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<AdminDeveloperResponse> {
    return this.admin.get(id);
  }

  @Post(':developerAccountId/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đổi trạng thái developer',
    description:
      'pending→active|rejected; active→suspended|banned; suspended→active|banned. Cần lý do khi rejected/suspended/banned. Chỉ Admin được banned. Không được tự duyệt account mình là thành viên.',
  })
  @ApiParam({ name: 'developerAccountId', format: 'uuid' })
  @ApiJsonBody('ChangeDeveloperStatusRequest')
  @ApiJsonResponses(
    { status: 200, schema: 'AdminDeveloperResponse', description: 'Developer sau khi đổi' },
    [400, 401, 403, 404, 409],
  )
  changeStatus(
    @CurrentUser() actor: AuthUser,
    @Param('developerAccountId', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(changeDeveloperStatusSchema)) body: ChangeDeveloperStatusInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminDeveloperResponse> {
    return this.admin.changeStatus(actor, id, body, auditContextFrom(request));
  }
}
