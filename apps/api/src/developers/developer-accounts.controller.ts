import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { DeveloperAccountResponse } from '@novastore/types';
import {
  updateDeveloperSchema,
  uuidSchema,
  type UpdateDeveloperInput,
} from '@novastore/validation';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { auditContextFrom } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApiJsonBody, ApiJsonResponses } from '../openapi/decorators';
import { DeveloperAccessService, type DeveloperContext } from './developer-access.service';
import { CurrentDeveloper, RequireDeveloper } from './developer.guard';
import { DevelopersService } from './developers.service';

/**
 * Truy cập developer account theo id — mẫu cho tài nguyên riêng của developer ở Phase 2B+.
 * Id không thuộc developer hiện tại trả 404 giống hệt id không tồn tại.
 */
@ApiTags('developers')
@ApiBearerAuth()
@Controller('developer/accounts')
export class DeveloperAccountsController {
  constructor(
    private readonly developers: DevelopersService,
    private readonly access: DeveloperAccessService,
  ) {}

  @Get(':developerAccountId')
  @RequireDeveloper('read')
  @ApiOperation({ summary: 'Developer account theo id (chỉ thành viên)' })
  @ApiParam({ name: 'developerAccountId', format: 'uuid' })
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAccountResponse', description: 'Hồ sơ developer' },
    [400, 401, 403, 404],
  )
  get(
    @CurrentDeveloper() developer: DeveloperContext,
    @Param('developerAccountId', new ZodValidationPipe(uuidSchema)) id: string,
  ): Promise<DeveloperAccountResponse> {
    this.access.assertOwnsAccount(developer, id);
    return this.developers.getAccount(developer);
  }

  @Patch(':developerAccountId')
  @RequireDeveloper('read')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sửa developer account theo id (chỉ owner/admin của account)' })
  @ApiParam({ name: 'developerAccountId', format: 'uuid' })
  @ApiJsonBody('UpdateDeveloperRequest')
  @ApiJsonResponses(
    { status: 200, schema: 'DeveloperAccountResponse', description: 'Hồ sơ sau khi sửa' },
    [400, 401, 403, 404, 429],
  )
  update(
    @CurrentUser() user: AuthUser,
    @CurrentDeveloper() developer: DeveloperContext,
    @Param('developerAccountId', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateDeveloperSchema)) body: UpdateDeveloperInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeveloperAccountResponse> {
    // Kiểm quyền sở hữu trước capability: id của người khác luôn là 404.
    this.access.assertOwnsAccount(developer, id);
    return this.developers.updateProfile(user, developer, body, auditContextFrom(request));
  }
}
