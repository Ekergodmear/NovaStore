import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STAFF_ROLES, type PlatformRole } from '@novastore/types';
import { ApiException } from '../common/api-exception';
import type { Env } from '../config/env';
import { ENV } from '../config/tokens';
import type { AuthenticatedRequest } from './auth-user';
import { ROLES_KEY } from './decorators';

const STAFF = new Set<PlatformRole>(STAFF_ROLES);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw ApiException.unauthenticated();
    }

    if (!required.some((role) => user.roles.includes(role))) {
      throw ApiException.forbidden('FORBIDDEN', 'Bạn không có quyền truy cập tài nguyên này');
    }

    const staffRoute = required.every((role) => STAFF.has(role));
    if (staffRoute && this.env.REQUIRE_STAFF_MFA && user.aal !== 'aal2') {
      throw ApiException.forbidden(
        'MFA_REQUIRED',
        'Cần xác thực hai lớp (MFA) cho khu vực quản trị',
      );
    }

    return true;
  }
}
