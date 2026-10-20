import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PlatformRole } from '@novastore/types';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { ENV, JWKS_RESOLVER, REDIS } from '../../src/config/tokens';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestKeys, signToken, testEnv, type TestKeys } from '../helpers';
import { startTestDatabase, type TestDatabase } from './database';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export interface IntegrationApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  database: TestDatabase;
  /** Request với IP giả ngẫu nhiên (qua X-Forwarded-For) để không chạm rate limit giữa các test. */
  http(): {
    get(path: string): request.Test;
    post(path: string): request.Test;
    patch(path: string): request.Test;
    delete(path: string): request.Test;
  };
  /** User mới (chưa có bản ghi; AuthGuard tạo ở request đầu tiên). */
  newUser(options?: { aal?: 'aal1' | 'aal2' }): Promise<TestUser>;
  /** User đã có sẵn trong DB với vai trò staff. */
  newStaff(
    role: Exclude<PlatformRole, 'user'>,
    options?: { aal?: 'aal1' | 'aal2' },
  ): Promise<TestUser>;
  close(): Promise<void>;
}

/** App NestJS đầy đủ (guard, service, Prisma thật) trên Postgres thật; chỉ Redis là giả. */
export async function createIntegrationApp(): Promise<IntegrationApp> {
  const database = await startTestDatabase();
  const keys: TestKeys = await createTestKeys();
  const env = testEnv({
    DATABASE_URL: database.url,
    REQUIRE_STAFF_MFA: 'true',
    TRUST_PROXY: 'true',
    OPENAPI_ENABLED: 'true',
  });
  const redis = { ping: vi.fn(async () => 'PONG'), status: 'wait', quit: vi.fn() };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(env)
    .overrideProvider(JWKS_RESOLVER)
    .useValue(keys.jwks)
    .overrideProvider(REDIS)
    .useValue(redis)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app, env);
  await app.init();
  const prisma = app.get(PrismaService);

  const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  const http = () => {
    const agent = request(app.getHttpServer());
    return {
      get: (path: string) => agent.get(path).set('X-Forwarded-For', randomIp()),
      post: (path: string) => agent.post(path).set('X-Forwarded-For', randomIp()),
      patch: (path: string) => agent.patch(path).set('X-Forwarded-For', randomIp()),
      delete: (path: string) => agent.delete(path).set('X-Forwarded-For', randomIp()),
    };
  };

  const newUser = async (options: { aal?: 'aal1' | 'aal2' } = {}): Promise<TestUser> => {
    const id = randomUUID();
    const email = `u-${id.slice(0, 8)}@novastore.test`;
    return {
      id,
      email,
      token: await signToken(keys, { sub: id, email, aal: options.aal ?? 'aal1' }),
    };
  };

  const newStaff: IntegrationApp['newStaff'] = async (role, options = {}) => {
    const user = await newUser({ aal: options.aal ?? 'aal2' });
    await prisma.user.create({ data: { id: user.id, email: user.email } });
    await prisma.userRole.create({ data: { userId: user.id, role } });
    return user;
  };

  return {
    app,
    prisma,
    database,
    http,
    newUser,
    newStaff,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

export function developerBody(overrides: Record<string, unknown> = {}) {
  const suffix = randomUUID().slice(0, 8);
  return {
    slug: `dev-${suffix}`,
    displayName: `Studio ${suffix}`,
    contactEmail: `contact-${suffix}@novastore.test`,
    website: 'https://studio.example.com',
    agreementVersion: '2026-10',
    ...overrides,
  };
}

/** Đăng ký developer qua API; `status` khác `pending` được staff (admin, MFA) chuyển qua API. */
export async function createDeveloper(
  t: IntegrationApp,
  status: 'pending' | 'active' | 'suspended' | 'banned' | 'rejected' = 'active',
) {
  const user = await t.newUser();
  const res = await t
    .http()
    .post('/api/v1/developers')
    .set('Authorization', `Bearer ${user.token}`)
    .send(developerBody());
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const accountId = res.body.id as string;
  const path: Record<typeof status, Array<[string, string?]>> = {
    pending: [],
    active: [['active']],
    suspended: [['active'], ['suspended', 'Tạm khóa kiểm thử']],
    banned: [['active'], ['banned', 'Cấm kiểm thử']],
    rejected: [['rejected', 'Từ chối kiểm thử']],
  };
  for (const [next, reason] of path[status]) {
    await setDeveloperStatus(t, accountId, next, reason);
  }
  return { user, accountId };
}

export async function setDeveloperStatus(
  t: IntegrationApp,
  accountId: string,
  status: string,
  reason?: string,
) {
  const admin = await t.newStaff('admin');
  const res = await t
    .http()
    .post(`/api/v1/admin/developers/${accountId}/status`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send(reason ? { status, reason } : { status });
  if (res.status !== 200) {
    throw new Error(`status ${status} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

/** Danh mục tạo thẳng trong DB (dữ liệu nền cho test app). */
export async function createCategory(t: IntegrationApp, options: { isActive?: boolean } = {}) {
  const suffix = randomUUID().slice(0, 8);
  return t.prisma.appCategory.create({
    data: {
      slug: `cat-${suffix}`,
      nameVi: `Danh mục ${suffix}`,
      nameEn: `Category ${suffix}`,
      isActive: options.isActive ?? true,
    },
  });
}

export function appBody(categoryId: string, overrides: Record<string, unknown> = {}) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  return {
    packageName: `vn.test.app${suffix}`,
    title: `App ${suffix}`,
    shortDescription: 'Ứng dụng kiểm thử ngắn gọn',
    fullDescription: 'Mô tả đầy đủ của ứng dụng kiểm thử, đủ dài để hợp lệ.',
    categoryId,
    supportEmail: `support-${suffix}@novastore.test`,
    supportUrl: 'https://support.example.com',
    privacyPolicyUrl: 'https://example.com/privacy',
    ...overrides,
  };
}
