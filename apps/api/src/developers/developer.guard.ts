import {
  applyDecorators,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { ApiException } from '../common/api-exception';
import {
  DeveloperAccessService,
  type DeveloperCapability,
  type DeveloperContext,
} from './developer-access.service';

const DEVELOPER_CAPABILITY_KEY = 'novastore:developerCapability';

type DeveloperRequest = AuthenticatedRequest & { developer?: DeveloperContext };

/** Chạy sau AuthGuard/RolesGuard toàn cục; resolve developer từ DB và kiểm capability. */
@Injectable()
export class DeveloperGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: DeveloperAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const capability =
      this.reflector.getAllAndOverride<DeveloperCapability | undefined>(DEVELOPER_CAPABILITY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'read';
    const request = context.switchToHttp().getRequest<DeveloperRequest>();
    if (!request.user) throw ApiException.unauthenticated();
    request.developer = await this.access.require(request.user, capability);
    return true;
  }
}

/** Route chỉ dành cho developer có capability tương ứng. */
export const RequireDeveloper = (capability: DeveloperCapability = 'read') =>
  applyDecorators(SetMetadata(DEVELOPER_CAPABILITY_KEY, capability), UseGuards(DeveloperGuard));

export const CurrentDeveloper = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeveloperContext => {
    const developer = ctx.switchToHttp().getRequest<DeveloperRequest>().developer;
    if (!developer) {
      // Lỗi lập trình: route dùng @CurrentDeveloper mà thiếu @RequireDeveloper.
      throw new Error('CurrentDeveloper used without RequireDeveloper');
    }
    return developer;
  },
);
