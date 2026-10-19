import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@novastore/database';
import { createHmac } from 'node:crypto';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user';
import type { Env } from '../config/env';
import { ENV } from '../config/tokens';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  ip?: string;
  requestId?: string;
}

export interface AuditEntry {
  actor: AuthUser | null;
  action: string;
  targetType: string;
  targetId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  context?: AuditContext;
}

export function auditContextFrom(request: AuthenticatedRequest): AuditContext {
  return { ip: request.ip, requestId: request.id ? String(request.id) : undefined };
}

/**
 * Ghi audit log append-only. Truyền `tx` để ghi trong cùng transaction với thay đổi nghiệp vụ.
 * Bảng audit_logs có trigger chặn UPDATE/DELETE ở tầng DB.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async record(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actor?.id ?? null,
        actorRole: entry.actor ? highestRole(entry.actor) : 'system',
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        before: entry.before,
        after: entry.after,
        ipHash: entry.context?.ip ? this.hashIp(entry.context.ip) : null,
        requestId: entry.context?.requestId ?? null,
      },
    });
  }

  private hashIp(ip: string): string {
    return createHmac('sha256', this.env.IP_HASH_SECRET).update(ip).digest('hex');
  }
}

function highestRole(user: AuthUser): string {
  if (user.roles.includes('admin')) return 'admin';
  if (user.roles.includes('moderator')) return 'moderator';
  return user.developerAccounts.length > 0 ? 'developer' : 'user';
}
