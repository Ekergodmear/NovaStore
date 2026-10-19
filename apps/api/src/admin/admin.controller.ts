import { Controller, Get } from '@nestjs/common';
import type { AdminDashboardResponse } from '@novastore/types';
import { Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60_000;

@Controller('admin')
@Roles('moderator', 'admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard(): Promise<AdminDashboardResponse> {
    const now = Date.now();
    const since24h = new Date(now - DAY_MS);
    const since30d = new Date(now - 30 * DAY_MS);

    const [pendingReview, submittedLast24h, openReports, activeDevelopers, decisions] =
      await Promise.all([
        this.prisma.appRelease.count({ where: { status: 'pending_review' } }),
        this.prisma.appRelease.count({ where: { submittedAt: { gte: since24h } } }),
        this.prisma.appReport.count({ where: { status: { in: ['open', 'triaged'] } } }),
        this.prisma.developerAccount.count({
          where: { status: 'active', apps: { some: { updatedAt: { gte: since30d } } } },
        }),
        this.prisma.moderationReview.groupBy({
          by: ['decision'],
          where: { createdAt: { gte: since30d }, decision: { in: ['approve', 'reject'] } },
          _count: { _all: true },
        }),
      ]);

    const approved = decisions.find((d) => d.decision === 'approve')?._count._all ?? 0;
    const rejected = decisions.find((d) => d.decision === 'reject')?._count._all ?? 0;
    const total = approved + rejected;

    return {
      pendingReview,
      submittedLast24h,
      openReports,
      activeDevelopers,
      approvalRate30d: total === 0 ? null : Math.round((approved / total) * 1000) / 1000,
    };
  }
}
