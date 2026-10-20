import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@novastore/database';
import type { MeResponse, PlatformRole } from '@novastore/types';
import type { UpdateMeInput } from '@novastore/validation';
import type { AuthUser } from '../auth/auth-user';
import type { AccessTokenClaims } from '../auth/jwt-verifier';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../prisma/prisma.service';

const LAST_SEEN_REFRESH_MS = 5 * 60_000;

const userInclude = {
  roles: { select: { role: true } },
  memberships: {
    select: {
      memberRole: true,
      developerAccount: { select: { id: true, slug: true, displayName: true, status: true } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Tải user + quyền từ Postgres; tạo bản ghi ở lần đăng nhập đầu tiên. */
  async resolveAuthUser(claims: AccessTokenClaims): Promise<AuthUser> {
    let user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: userInclude,
    });

    if (!user) {
      user = await this.createUser(claims);
    } else {
      this.touch(user, claims);
    }

    return toAuthUser(user, claims.aal);
  }

  async updateMe(actor: AuthUser, input: UpdateMeInput, context: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      const select = { displayName: true, avatarUrl: true } as const;
      const before = await tx.user.findUniqueOrThrow({ where: { id: actor.id }, select });
      const after = await tx.user.update({ where: { id: actor.id }, data: input, select });
      await this.audit.record(
        {
          actor,
          action: 'user.update',
          targetType: 'user',
          targetId: actor.id,
          before,
          after,
          context,
        },
        tx,
      );
      return after;
    });
  }

  private async createUser(claims: AccessTokenClaims): Promise<UserWithAccess> {
    try {
      return await this.prisma.user.create({
        data: { id: claims.sub, email: claims.email, lastSeenAt: new Date() },
        include: userInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Hai request đồng thời cùng tạo user: đọc lại bản đã tạo.
        const existing = await this.prisma.user.findUnique({
          where: { id: claims.sub },
          include: userInclude,
        });
        if (existing) return existing;
        throw ApiException.conflict('CONFLICT', 'Email đã gắn với một tài khoản khác');
      }
      throw error;
    }
  }

  /** Cập nhật last_seen_at (tối đa 5 phút/lần) và email nếu đổi; không chặn request. */
  private touch(user: UserWithAccess, claims: AccessTokenClaims): void {
    const stale = !user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS;
    const emailChanged = claims.email !== null && claims.email !== user.email;
    if (!stale && !emailChanged) return;

    this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastSeenAt: new Date(), ...(emailChanged ? { email: claims.email } : {}) },
      })
      .catch((error: unknown) =>
        this.logger.warn(`Không cập nhật được user ${user.id}: ${String(error)}`),
      );
  }
}

export function toAuthUser(user: UserWithAccess, aal: AuthUser['aal']): AuthUser {
  const roles = new Set<PlatformRole>(['user', ...user.roles.map((r) => r.role)]);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    roles: [...roles],
    developerAccounts: user.memberships.map((m) => ({
      developerAccountId: m.developerAccount.id,
      slug: m.developerAccount.slug,
      displayName: m.developerAccount.displayName,
      memberRole: m.memberRole,
      status: m.developerAccount.status,
    })),
    aal,
  };
}

export function toMeResponse(user: AuthUser): MeResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    roles: user.roles,
    developerAccounts: user.developerAccounts,
    mfa: { level: user.aal },
  };
}
