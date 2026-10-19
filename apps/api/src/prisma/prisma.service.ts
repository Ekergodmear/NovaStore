import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@novastore/database';
import type { Env } from '../config/env';
import { ENV } from '../config/tokens';

/** Prisma kết nối lười ở truy vấn đầu tiên để API vẫn khởi động khi DB tạm thời chưa sẵn sàng. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ datasourceUrl: env.DATABASE_URL });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
