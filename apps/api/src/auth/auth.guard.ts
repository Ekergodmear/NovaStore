import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../common/api-exception';
import { IdentityService } from '../identity/identity.service';
import type { AuthenticatedRequest } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';
import { InvalidTokenError, JwtVerifier } from './jwt-verifier';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw ApiException.unauthenticated('Thiếu Bearer token');
    }

    let claims;
    try {
      claims = await this.verifier.verify(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw ApiException.unauthenticated('Token không hợp lệ hoặc đã hết hạn');
      }
      throw error;
    }

    const user = await this.identity.resolveAuthUser(claims);
    if (user.status !== 'active') {
      throw ApiException.forbidden('ACCOUNT_SUSPENDED', 'Tài khoản đã bị khóa');
    }

    request.user = user;
    return true;
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value, ...rest] = header.trim().split(/\s+/);
  if (rest.length > 0 || scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value;
}
