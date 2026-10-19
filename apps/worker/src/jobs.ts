import { z } from '@novastore/validation';

/** Tên queue dùng chung giữa API (producer) và worker (consumer). */
export const QUEUES = {
  apkProcessing: 'apk-processing',
} as const;

export const inspectAndScanJobSchema = z.object({
  releaseId: z.uuid(),
  artifactId: z.uuid(),
  quarantineKey: z.string().min(1).max(512),
  sizeBytes: z.number().int().positive(),
});
export type InspectAndScanJob = z.infer<typeof inspectAndScanJobSchema>;

/** jobId xác định để BullMQ không xử lý trùng một artifact. */
export function inspectJobId(artifactId: string): string {
  return `inspect:${artifactId}`;
}
