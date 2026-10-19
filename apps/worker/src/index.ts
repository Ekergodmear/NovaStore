import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { QUEUES } from './jobs';
import { processInspectAndScan } from './processor';

try {
  process.loadEnvFile();
} catch {
  // Không có .env: dùng biến môi trường của tiến trình.
}

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
});

// BullMQ yêu cầu maxRetriesPerRequest = null cho kết nối của Worker.
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  QUEUES.apkProcessing,
  (job) => processInspectAndScan(job.data, logger.child({ jobId: job.id })),
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1) },
);

worker.on('failed', (job, error) => logger.error({ jobId: job?.id, err: error }, 'job failed'));
worker.on('ready', () => logger.info({ queue: QUEUES.apkProcessing }, 'worker ready'));

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
