import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { ENV, JWKS_RESOLVER, REDIS } from '../src/config/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma, type FakePrisma } from './fake-prisma';
import { createTestKeys, signToken, testEnv, type TestKeys } from './helpers';

const USER_ID = '0199f0a2-0000-7000-8000-000000000001';
const ADMIN_ID = '0199f0a2-0000-7000-8000-000000000002';
const SUSPENDED_ID = '0199f0a2-0000-7000-8000-000000000003';
const NEW_USER_ID = '0199f0a2-0000-7000-8000-000000000004';

describe('API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: FakePrisma;
  let keys: TestKeys;
  const redis = { ping: vi.fn(async () => 'PONG'), status: 'wait', quit: vi.fn() };

  const http = () => request(app.getHttpServer());
  const tokenFor = (sub: string, aal: 'aal1' | 'aal2' = 'aal1', email?: string) =>
    signToken(keys, { sub, aal, email });

  beforeAll(async () => {
    keys = await createTestKeys();
    prisma = createFakePrisma();
    const env = testEnv();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(JWKS_RESOLVER)
      .useValue(keys.jwks)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(REDIS)
      .useValue(redis)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
    configureApp(app, env);
    await app.init();
  });

  beforeEach(() => {
    prisma.users.clear();
    prisma.seedUser({ id: USER_ID, email: 'user@novastore.test' });
    prisma.seedUser({ id: ADMIN_ID, email: 'admin@novastore.test', roles: ['admin'] });
    prisma.seedUser({ id: SUSPENDED_ID, email: 'bad@novastore.test', status: 'suspended' });
    prisma.auditLog.create.mockClear();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('health', () => {
    it('GET /healthz không cần auth', async () => {
      await http().get('/healthz').expect(200, { status: 'ok' });
    });

    it('GET /readyz báo trạng thái phụ thuộc', async () => {
      const res = await http().get('/readyz').expect(200);
      expect(res.body).toEqual({ status: 'ok', checks: { database: 'ok', redis: 'ok' } });
    });

    it('GET /readyz trả 503 khi Redis lỗi', async () => {
      redis.ping.mockRejectedValueOnce(new Error('down'));
      const res = await http().get('/readyz').expect(503);
      expect(res.body.checks.redis).toBe('error');
    });
  });

  describe('xác thực', () => {
    it('trả 401 Problem Details khi thiếu token', async () => {
      const res = await http().get('/api/v1/me').expect(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('trả 401 khi token sai', async () => {
      await http().get('/api/v1/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    });

    it('trả lại X-Request-Id do client gửi', async () => {
      const res = await http().get('/api/v1/me').set('X-Request-Id', 'req-123').expect(401);
      expect(res.headers['x-request-id']).toBe('req-123');
      expect(res.body.requestId).toBe('req-123');
    });

    it('GET /me trả profile và vai trò', async () => {
      const res = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${await tokenFor(USER_ID)}`)
        .expect(200);
      expect(res.body).toMatchObject({
        id: USER_ID,
        email: 'user@novastore.test',
        roles: ['user'],
        developerAccounts: [],
        mfa: { level: 'aal1' },
      });
    });

    it('tạo user ở lần đăng nhập đầu tiên', async () => {
      const token = await tokenFor(NEW_USER_ID, 'aal1', 'new@novastore.test');
      const res = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({ id: NEW_USER_ID, email: 'new@novastore.test' });
      expect(prisma.users.has(NEW_USER_ID)).toBe(true);
    });

    it('trả 403 ACCOUNT_SUSPENDED với tài khoản bị khóa', async () => {
      const res = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${await tokenFor(SUSPENDED_ID)}`)
        .expect(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('RBAC admin', () => {
    it('user thường bị 403 ở /admin/dashboard', async () => {
      const res = await http()
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${await tokenFor(USER_ID, 'aal2')}`)
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('admin chưa MFA bị 403 MFA_REQUIRED', async () => {
      const res = await http()
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${await tokenFor(ADMIN_ID, 'aal1')}`)
        .expect(403);
      expect(res.body.code).toBe('MFA_REQUIRED');
    });

    it('admin có MFA xem được dashboard', async () => {
      const res = await http()
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${await tokenFor(ADMIN_ID, 'aal2')}`)
        .expect(200);
      expect(res.body).toEqual({
        pendingReview: 2,
        submittedLast24h: 2,
        openReports: 1,
        activeDevelopers: 5,
        approvalRate30d: 0.75,
      });
    });
  });

  describe('PATCH /me', () => {
    it('từ chối body không hợp lệ với 400 VALIDATION_FAILED', async () => {
      const res = await http()
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${await tokenFor(USER_ID)}`)
        .send({ displayName: '', roles: ['admin'] })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors.length).toBeGreaterThan(0);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('cập nhật profile và ghi audit log', async () => {
      const res = await http()
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${await tokenFor(USER_ID)}`)
        .send({ displayName: 'Khôi' })
        .expect(200);
      expect(res.body.displayName).toBe('Khôi');
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: USER_ID,
          action: 'user.update',
          targetType: 'user',
          targetId: USER_ID,
          before: { displayName: null, avatarUrl: null },
          after: { displayName: 'Khôi', avatarUrl: null },
          ipHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });
  });

  it('route không tồn tại trả 404 Problem Details', async () => {
    const res = await http()
      .get('/api/v1/does-not-exist')
      .set('Authorization', `Bearer ${await tokenFor(USER_ID)}`)
      .expect(404);
    expect(res.body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('JSON hỏng trả 400 Problem Details', async () => {
    const res = await http()
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${await tokenFor(USER_ID)}`)
      .set('Content-Type', 'application/json')
      .send('{"displayName":')
      .expect(400);
    expect(res.body.status).toBe(400);
  });
});
