import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  APP_STATUSES,
  type CursorPage,
  type DeveloperAppResponse,
  type DeveloperAppSummary,
} from '@novastore/types';
import {
  createAppSchema,
  developerAppListQuerySchema,
  updateAppSchema,
  uuidSchema,
  type CreateAppInput,
  type DeveloperAppListQuery,
  type UpdateAppInput,
} from '@novastore/validation';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { auditContextFrom } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { DeveloperContext } from '../developers/developer-access.service';
import { CurrentDeveloper, RequireDeveloper } from '../developers/developer.guard';
import { ApiJsonBody, ApiJsonResponses } from '../openapi/decorators';
import { DeveloperAppsService } from './developer-apps.service';

const appIdPipe = new ZodValidationPipe(uuidSchema);

@ApiTags('developer apps')
@ApiBearerAuth()
@Controller('developer/apps')
export class DeveloperAppsController {
  constructor(private readonly apps: DeveloperAppsService) {}

  @Post()
  @HttpCode(201)
  @RequireDeveloper('publish')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Tạo ứng dụng (draft)',
    description:
      'Chỉ developer `active`. Chủ sở hữu là developer hiện tại; package name unique toàn hệ thống và không sửa được.',
  })
  @ApiJsonBody('CreateAppRequest')
  @ApiJsonResponses(
    { status: 201, schema: 'DeveloperAppResponse', description: 'App draft vừa tạo' },
    [400, 401, 403, 409, 429],
  )
  create(
    @CurrentUser() user: AuthUser,
    @CurrentDeveloper() developer: DeveloperContext,
    @Body(new ZodValidationPipe(createAppSchema)) body: CreateAppInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeveloperAppResponse> {
    return this.apps.create(user, developer, body, auditContextFrom(request));
  }

  @Get()
  @RequireDeveloper('read')
  @ApiOperation({ summary: 'Danh sách app của developer hiện tại (mặc định ẩn archived)' })
  @ApiQuery({ name: 'status', required: false, enum: APP_STATUSES })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAppPage', description: 'Một trang app' },
    [400, 401, 403],
  )
  list(
    @CurrentDeveloper() developer: DeveloperContext,
    @Query(new ZodValidationPipe(developerAppListQuerySchema)) query: DeveloperAppListQuery,
  ): Promise<CursorPage<DeveloperAppSummary>> {
    return this.apps.list(developer, query);
  }

  @Get(':appId')
  @RequireDeveloper('read')
  @ApiOperation({ summary: 'Chi tiết app (chỉ app của developer hiện tại)' })
  @ApiParam({ name: 'appId', format: 'uuid' })
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAppResponse', description: 'App' },
    [400, 401, 403, 404],
  )
  get(
    @CurrentDeveloper() developer: DeveloperContext,
    @Param('appId', appIdPipe) appId: string,
  ): Promise<DeveloperAppResponse> {
    return this.apps.get(developer, appId);
  }

  /** Guard `read` + kiểm sở hữu trước capability trong service: id của người khác luôn 404. */
  @Patch(':appId')
  @RequireDeveloper('read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Sửa metadata app draft',
    description:
      'Cần developer `active` và app ở `draft`. Không sửa được packageName, status, chủ sở hữu.',
  })
  @ApiParam({ name: 'appId', format: 'uuid' })
  @ApiJsonBody('UpdateAppRequest')
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAppResponse', description: 'App sau khi sửa' },
    [400, 401, 403, 404, 409, 429],
  )
  update(
    @CurrentUser() user: AuthUser,
    @CurrentDeveloper() developer: DeveloperContext,
    @Param('appId', appIdPipe) appId: string,
    @Body(new ZodValidationPipe(updateAppSchema)) body: UpdateAppInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeveloperAppResponse> {
    return this.apps.update(user, developer, appId, body, auditContextFrom(request));
  }

  @Post(':appId/archive')
  @HttpCode(200)
  @RequireDeveloper('read')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Lưu trữ app (draft | rejected → archived)',
    description:
      'Không xóa cứng. App chưa từng phát hành được giải phóng package name để có thể đăng ký lại.',
  })
  @ApiParam({ name: 'appId', format: 'uuid' })
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAppResponse', description: 'App đã archived' },
    [400, 401, 403, 404, 409, 429],
  )
  archive(
    @CurrentUser() user: AuthUser,
    @CurrentDeveloper() developer: DeveloperContext,
    @Param('appId', appIdPipe) appId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeveloperAppResponse> {
    return this.apps.archive(user, developer, appId, auditContextFrom(request));
  }
}
