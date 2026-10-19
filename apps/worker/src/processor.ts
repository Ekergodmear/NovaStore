import type { Logger } from 'pino';
import { inspectAndScanJobSchema } from './jobs';

export interface ProcessingOutcome {
  releaseId: string;
  status: 'not_implemented';
}

/**
 * Phase 1: chỉ kiểm tra payload và ghi log.
 * Phase 3 sẽ chuyển APK vào sandbox cô lập (không mạng, không secret) theo
 * docs/APK_SECURITY_PIPELINE.md §3 — tuyệt đối không phân tích APK trong tiến trình này.
 */
export async function processInspectAndScan(
  data: unknown,
  logger: Logger,
): Promise<ProcessingOutcome> {
  const job = inspectAndScanJobSchema.parse(data);
  logger.info(
    { releaseId: job.releaseId, artifactId: job.artifactId },
    'inspect-and-scan received',
  );
  return { releaseId: job.releaseId, status: 'not_implemented' };
}
