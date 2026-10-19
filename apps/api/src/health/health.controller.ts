import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import type Redis from 'ioredis';
import { Public } from '../auth/decorators';
import { REDIS } from '../config/tokens';
import { PrismaService } from '../prisma/prisma.service';

const CHECK_TIMEOUT_MS = 2_000;

type CheckResult = 'ok' | 'error';

@Controller()
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness: tiến trình còn sống. */
  @Get('healthz')
  health() {
    return { status: 'ok' };
  }

  /** Readiness: phụ thuộc chính sẵn sàng. */
  @Get('readyz')
  async ready(@Res({ passthrough: true }) response: Response) {
    const [database, redis] = await Promise.all([
      check(() => this.prisma.$queryRaw`SELECT 1`),
      check(() => this.redis.ping()),
    ]);
    const ok = database === 'ok' && redis === 'ok';
    response.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'error', checks: { database, redis } };
  }
}

async function check(fn: () => Promise<unknown>): Promise<CheckResult> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
      }),
    ]);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}
