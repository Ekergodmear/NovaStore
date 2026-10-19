import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { MeResponse } from '@novastore/types';
import { updateMeSchema, type UpdateMeInput } from '@novastore/validation';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { auditContextFrom } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IdentityService, toMeResponse } from './identity.service';

@Controller('me')
export class MeController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): MeResponse {
    return toMeResponse(user);
  }

  @Patch()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<MeResponse> {
    const updated = await this.identity.updateMe(user, body, auditContextFrom(request));
    return toMeResponse({ ...user, ...updated });
  }
}
