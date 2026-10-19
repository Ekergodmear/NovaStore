import pino from 'pino';
import { inspectJobId } from './jobs';
import { processInspectAndScan } from './processor';

const logger = pino({ level: 'silent' });

describe('processInspectAndScan', () => {
  const valid = {
    releaseId: '0199f0a2-0000-7000-8000-000000000010',
    artifactId: '0199f0a2-0000-7000-8000-000000000011',
    quarantineKey: 'uploads/0199f0a2/abc',
    sizeBytes: 1024,
  };

  it('chấp nhận payload hợp lệ', async () => {
    await expect(processInspectAndScan(valid, logger)).resolves.toEqual({
      releaseId: valid.releaseId,
      status: 'not_implemented',
    });
  });

  it('từ chối payload sai', async () => {
    await expect(processInspectAndScan({ ...valid, releaseId: 'x' }, logger)).rejects.toThrow();
  });

  it('jobId xác định theo artifact', () => {
    expect(inspectJobId(valid.artifactId)).toBe(`inspect:${valid.artifactId}`);
  });
});
