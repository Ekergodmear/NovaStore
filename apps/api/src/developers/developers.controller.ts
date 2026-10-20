import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  DeveloperAccountResponse,
  DeveloperStatusResponse,
  PublicDeveloperProfile,
} from '@novastore/types';
import {
  createDeveloperSchema,
  slugSchema,
  updateDeveloperSchema,
  type CreateDeveloperInput,
  type UpdateDeveloperInput,
} from '@novastore/validation';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user';
import { CurrentUser, Public } from '../auth/decorators';
import { auditContextFrom } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApiJsonBody, ApiJsonResponses } from '../openapi/decorators';
import { notFound, type DeveloperContext } from './developer-access.service';
import { CurrentDeveloper, RequireDeveloper } from './developer.guard';
import { DevelopersService } from './developers.service';

@ApiTags('developers')
@ApiBearerAuth()
@Controller('developers')
export class DevelopersController {
  constructor(private readonly developers: DevelopersService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Đăng ký tài khoản nhà phát triển',
    description:
      'User hiện tại trở thành owner. Account bắt đầu ở `pending` và chờ staff duyệt. Mỗi user tối đa một account.',
  })
  @ApiJsonBody('CreateDeveloperRequest')
  @ApiJsonResponses(
    { status: 201, schema: 'DeveloperAccountResponse', description: 'Đã tạo, trạng thái pending' },
    [400, 401, 403, 409, 429],
  )
  register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDeveloperSchema)) body: CreateDeveloperInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeveloperAccountResponse> {
    return this.developers.register(user, body, auditContextFrom(request));
  }

  @Get('me')
  @RequireDeveloper('read')
  @ApiOperation({ summary: 'Hồ sơ developer của user hiện tại (riêng tư)' })
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAccountResponse', description: 'Hồ sơ developer' },
    [401, 403],
  )
  getMe(@CurrentDeveloper() developer: DeveloperContext): Promise<DeveloperAccountResponse> {
    return this.developers.getAccount(developer);
  }

  @Patch('me')
  @RequireDeveloper('read')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Sửa hồ sơ developer của user hiện tại',
    description:
      'Chỉ displayName, contactEmail, website. Cần trạng thái pending/active và vai trò owner/admin.',
  })
  @ApiJsonBody('UpdateDeveloperRequest')
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAccountResponse', description: 'Hồ sơ sau khi sửa' },
    [400, 401, 403, 429],
  )
  updateMe(
    @CurrentUser() user: AuthUser,
    @CurrentDeveloper() developer: DeveloperContext,
    @Body(new ZodValidationPipe(updateDeveloperSchema)) body: UpdateDeveloperInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeveloperAccountResponse> {
    return this.developers.updateProfile(user, developer, body, auditContextFrom(request));
  }

  @Get('me/status')
  @RequireDeveloper('read')
  @ApiOperation({ summary: 'Trạng thái và quyền hiện hành của developer' })
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperStatusResponse', description: 'Trạng thái developer' },
    [401, 403],
  )
  getMyStatus(@CurrentDeveloper() developer: DeveloperContext): Promise<DeveloperStatusResponse> {
    return this.developers.getStatus(developer);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Hồ sơ công khai của developer đang active' })
  @ApiParam({ name: 'slug', example: 'acme-studio' })
  @ApiJsonResponses(
    { status: 200, schema: 'PublicDeveloperProfile', description: 'Hồ sơ công khai' },
    [404],
  )
  getPublic(@Param('slug') slug: string): Promise<PublicDeveloperProfile> {
    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) throw notFound();
    return this.developers.getPublicProfile(parsed.data);
  }
}
