import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { Env } from '../config/env';
import { ENV, REDIS } from '../config/tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => {
        const logger = new Logger('Redis');
        const client = new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
        });
        let lastErrorLog = 0;
        client.on('error', (error) => {
          // Tránh spam log khi Redis down: tối đa 1 dòng / 30 giây.
          if (Date.now() - lastErrorLog > 30_000) {
            lastErrorLog = Date.now();
            logger.warn(`Redis error: ${error.message}`);
          }
        });
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end' && this.redis.status !== 'wait') {
      await this.redis.quit().catch(() => this.redis.disconnect());
    }
  }
}
