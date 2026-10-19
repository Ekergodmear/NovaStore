import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '@novastore/types';
import { ApiException } from '../common/api-exception';
import type { AuthenticatedRequest, AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'novastore:isPublic';
export const ROLES_KEY = 'novastore:roles';

/** Bỏ qua xác thực. Mặc định mọi route đều yêu cầu đăng nhập (deny by default). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Yêu cầu ít nhất một trong các vai trò. */
export const Roles = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw ApiException.unauthenticated();
    }
    return request.user;
  },
);
