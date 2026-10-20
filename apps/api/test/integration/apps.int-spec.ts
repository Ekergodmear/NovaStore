import { randomUUID } from 'node:crypto';
import { DeveloperAppsService } from '../../src/apps/developer-apps.service';
import type { AuthUser } from '../../src/auth/auth-user';
import { DeveloperAccessService } from '../../src/developers/developer-access.service';
import {
  appBody,
  createCategory,
  createDeveloper,
  createIntegrationApp,
  setDeveloperStatus,
  type IntegrationApp,
  type TestUser,
} from './harness';

const bearer = (user: TestUser) => `Bearer ${user.token}`;

describe('App management Phase 2B (integration, Postgres thật)', () => {
  let t: IntegrationApp;
  let categoryId: string;

  beforeAll(async () => {
    t = await createIntegrationApp();
    categoryId = (await createCategory(t)).id;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
  });

  async function createApp(user: TestUser, overrides: Record<string, unknown> = {}) {
    const res = await t
      .http()
      .post('/api/v1/developer/apps')
      .set('Authorization', bearer(user))
      .send(appBody(categoryId, overrides));
    return res;
  }

  /** Developer active + một app draft của họ. */
  async function developerWithApp() {
    const dev = await createDeveloper(t, 'active');
    const res = await createApp(dev.user);
    expect(res.status).toBe(201);
    return { ...dev, app: res.body as { id: string; packageName: string; slug: string } };
  }

  const audits = (targetId: string, action: string) =>
    t.prisma.auditLog.findMany({ where: { targetId, action }, orderBy: { id: 'asc' } });

  describe('tạo ứng dụng', () => {
    it('developer active tạo app draft; chủ sở hữu lấy từ server; ghi audit', async () => {
      const { user, accountId } = await createDeveloper(t, 'active');
      const body = appBody(categoryId);
      const res = await t
        .http()
        .post('/api/v1/developer/apps')
        .set('Authorization', bearer(user))
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        packageName: body.packageName,
        packageNameReleased: false,
        title: body.title,
        status: 'draft',
        category: { id: categoryId },
        supportEmail: body.supportEmail,
        contentRating: 'everyone',
        containsAds: false,
        defaultLocale: 'vi',
        capabilities: { canEdit: true, canArchive: true },
      });
      expect(res.body.slug).toBe(body.packageName.replace(/\./g, '-'));

      const row = await t.prisma.app.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.developerAccountId).toBe(accountId);

      const [audit] = await audits(res.body.id, 'app.create');
      expect(audit).toMatchObject({
        actorId: user.id,
        targetType: 'app',
        after: expect.objectContaining({ packageName: body.packageName, status: 'draft' }),
      });
    });

    it('package name trùng → 409 PACKAGE_NAME_TAKEN (kể cả developer khác)', async () => {
      const a = await developerWithApp();
      const b = await createDeveloper(t, 'active');
      const res = await createApp(b.user, { packageName: a.app.packageName });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PACKAGE_NAME_TAKEN');
      expect(await t.prisma.app.count({ where: { packageName: a.app.packageName } })).toBe(1);
    });

    it('package name dành riêng → 400 PACKAGE_NAME_RESERVED', async () => {
      const { user } = await createDeveloper(t, 'active');
      for (const packageName of [
        'com.google.android.youtube',
        'android.test',
        'vn.novastore.store',
      ]) {
        const res = await createApp(user, { packageName });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PACKAGE_NAME_RESERVED');
      }
    });

    it.each([
      ['không tồn tại', () => randomUUID()],
      ['sai định dạng', () => 'not-a-uuid'],
    ])('danh mục %s → 400', async (_label, makeId) => {
      const { user } = await createDeveloper(t, 'active');
      const res = await createApp(user, { categoryId: makeId() });
      expect(res.status).toBe(400);
      expect(['INVALID_CATEGORY', 'VALIDATION_FAILED']).toContain(res.body.code);
    });

    it('danh mục đang ẩn → 400 INVALID_CATEGORY', async () => {
      const hidden = await createCategory(t, { isActive: false });
      const { user } = await createDeveloper(t, 'active');
      const res = await createApp(user, { categoryId: hidden.id });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CATEGORY');
    });

    it.each([
      ['packageName sai định dạng', { packageName: 'notapackage' }],
      ['title quá dài', { title: 'x'.repeat(51) }],
      ['shortDescription quá ngắn', { shortDescription: 'ngắn' }],
      ['fullDescription quá dài', { fullDescription: 'x'.repeat(4001) }],
      ['privacyPolicyUrl http', { privacyPolicyUrl: 'http://example.com/privacy' }],
      ['supportUrl không phải URL', { supportUrl: 'not a url' }],
      ['supportEmail sai', { supportEmail: 'not-an-email' }],
      ['contentRating lạ', { contentRating: 'adults' }],
    ])('metadata không hợp lệ (%s) → 400', async (_label, overrides) => {
      const { user } = await createDeveloper(t, 'active');
      const res = await createApp(user, overrides);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('thiếu trường bắt buộc (supportEmail) → 400', async () => {
      const { user } = await createDeveloper(t, 'active');
      const { supportEmail: _omit, ...body } = appBody(categoryId);
      const res = await t
        .http()
        .post('/api/v1/developer/apps')
        .set('Authorization', bearer(user))
        .send(body)
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('không token → 401; user chưa là developer → 403', async () => {
      await t.http().post('/api/v1/developer/apps').send(appBody(categoryId)).expect(401);
      const plain = await t.newUser();
      const res = await createApp(plain);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('DEVELOPER_ACCOUNT_REQUIRED');
    });

    it.each(['pending', 'suspended', 'banned', 'rejected'] as const)(
      'developer %s không tạo được app → 403, DB không có app',
      async (status) => {
        const { user, accountId } = await createDeveloper(t, status);
        const res = await createApp(user);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DEVELOPER_ACCOUNT_NOT_ACTIVE');
        expect(await t.prisma.app.count({ where: { developerAccountId: accountId } })).toBe(0);
      },
    );

    it.each([
      ['developerAccountId', () => ({ developerAccountId: randomUUID() })],
      ['status', () => ({ status: 'published' })],
      ['slug', () => ({ slug: 'custom-slug' })],
      ['id', () => ({ id: randomUUID() })],
      ['currentReleaseId', () => ({ currentReleaseId: randomUUID() })],
      ['ratingAvg', () => ({ ratingAvg: 5 })],
      ['downloadCount', () => ({ downloadCount: 1_000_000 })],
      ['signerLineageSha256', () => ({ signerLineageSha256: ['a'.repeat(64)] })],
    ])('mass assignment %s khi tạo → 400, không tạo app', async (_field, extra) => {
      const { user, accountId } = await createDeveloper(t, 'active');
      const res = await createApp(user, extra());
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(await t.prisma.app.count({ where: { developerAccountId: accountId } })).toBe(0);
    });

    it('nhiều developer tạo cùng package name đồng thời → đúng 1 thành công', async () => {
      const packageName = `vn.race.app${randomUUID().replace(/-/g, '').slice(0, 10)}`;
      const devs = await Promise.all(Array.from({ length: 5 }, () => createDeveloper(t, 'active')));
      const results = await Promise.all(devs.map((d) => createApp(d.user, { packageName })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      for (const r of results.filter((r) => r.status !== 201)) {
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('PACKAGE_NAME_TAKEN');
      }
      expect(await t.prisma.app.count({ where: { packageName } })).toBe(1);
    });

    it('một developer tạo nhiều app đồng thời (package khác nhau) → tất cả thành công', async () => {
      const { user, accountId } = await createDeveloper(t, 'active');
      const results = await Promise.all(Array.from({ length: 5 }, () => createApp(user)));
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(await t.prisma.app.count({ where: { developerAccountId: accountId } })).toBe(5);
    });

    it('slug trùng (package gần giống) → tự thêm hậu tố, vẫn tạo được', async () => {
      const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
      const a = await createDeveloper(t, 'active');
      const b = await createDeveloper(t, 'active');
      const first = await createApp(a.user, { packageName: `vn.slug.a${suffix}_x` });
      const second = await createApp(b.user, { packageName: `vn.slug.a${suffix}.x` });
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.slug).toBe(`vn-slug-a${suffix}-x`);
      expect(second.body.slug).toMatch(new RegExp(`^vn-slug-a${suffix}-x-[0-9a-f]{6}$`));
    });
  });

  describe('đọc và danh sách (cô lập theo chủ sở hữu)', () => {
    it('danh sách chỉ gồm app của mình; phân trang cursor', async () => {
      const { user, accountId } = await createDeveloper(t, 'active');
      for (let i = 0; i < 3; i++) expect((await createApp(user)).status).toBe(201);
      const other = await developerWithApp();

      const page1 = await t
        .http()
        .get('/api/v1/developer/apps?limit=2')
        .set('Authorization', bearer(user))
        .expect(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.nextCursor).toEqual(expect.any(String));
      const page2 = await t
        .http()
        .get(`/api/v1/developer/apps?limit=2&cursor=${page1.body.nextCursor}`)
        .set('Authorization', bearer(user))
        .expect(200);
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.nextCursor).toBeNull();

      const ids = [...page1.body.data, ...page2.body.data].map((a: { id: string }) => a.id);
      expect(ids).not.toContain(other.app.id);
      const owned = await t.prisma.app.findMany({ where: { developerAccountId: accountId } });
      expect(new Set(ids)).toEqual(new Set(owned.map((a) => a.id)));
    });

    it('developer bị suspended vẫn xem được app của mình nhưng không sửa được', async () => {
      const { user, accountId, app } = await developerWithApp();
      await setDeveloperStatus(t, accountId, 'suspended', 'Kiểm tra');
      await t
        .http()
        .get(`/api/v1/developer/apps/${app.id}`)
        .set('Authorization', bearer(user))
        .expect(200);
      const list = await t
        .http()
        .get('/api/v1/developer/apps')
        .set('Authorization', bearer(user))
        .expect(200);
      expect(list.body.data.map((a: { id: string }) => a.id)).toContain(app.id);
      const detail = await t
        .http()
        .get(`/api/v1/developer/apps/${app.id}`)
        .set('Authorization', bearer(user));
      expect(detail.body.capabilities).toEqual({ canEdit: false, canArchive: false });

      const res = await t
        .http()
        .patch(`/api/v1/developer/apps/${app.id}`)
        .set('Authorization', bearer(user))
        .send({ title: 'Sửa khi bị khóa' })
        .expect(403);
      expect(res.body.code).toBe('DEVELOPER_ACCOUNT_NOT_ACTIVE');
      await t
        .http()
        .post(`/api/v1/developer/apps/${app.id}/archive`)
        .set('Authorization', bearer(user))
        .expect(403);
      const row = await t.prisma.app.findUniqueOrThrow({ where: { id: app.id } });
      expect(row.status).toBe('draft');
    });
  });

  describe('IDOR: developer A với app của developer B', () => {
    it.each([
      ['GET', (id: string) => ['get', `/api/v1/developer/apps/${id}`, undefined] as const],
      [
        'PATCH',
        (id: string) => ['patch', `/api/v1/developer/apps/${id}`, { title: 'Pwned App' }] as const,
      ],
      [
        'archive',
        (id: string) => ['post', `/api/v1/developer/apps/${id}/archive`, undefined] as const,
      ],
    ])('%s app của B → 404 giống hệt id không tồn tại; app của B không đổi', async (_l, route) => {
      const a = await createDeveloper(t, 'active');
      const b = await developerWithApp();
      const before = await t.prisma.app.findUniqueOrThrow({ where: { id: b.app.id } });

      const send = async (id: string) => {
        const [method, path, body] = route(id);
        const req = t.http()[method](path).set('Authorization', bearer(a.user));
        return body ? req.send(body) : req;
      };
      const foreign = await send(b.app.id);
      const missing = await send(randomUUID());
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      const strip = (x: Record<string, unknown>) => ({ ...x, requestId: undefined });
      expect(strip(foreign.body)).toEqual(strip(missing.body));
      expect(JSON.stringify(foreign.body)).not.toContain(b.app.packageName);

      const after = await t.prisma.app.findUniqueOrThrow({ where: { id: b.app.id } });
      expect(after).toEqual(before);
      expect(await audits(b.app.id, 'app.update')).toHaveLength(0);
    });

    it('developer bị khóa gọi app của người khác vẫn nhận 404 (không phải 403)', async () => {
      const a = await createDeveloper(t, 'suspended');
      const b = await developerWithApp();
      await t
        .http()
        .patch(`/api/v1/developer/apps/${b.app.id}`)
        .set('Authorization', bearer(a.user))
        .send({ title: 'Probe App' })
        .expect(404);
    });

    it('header/query giả danh developer khác bị bỏ qua', async () => {
      const a = await developerWithApp();
      const b = await developerWithApp();
      const res = await t
        .http()
        .get(`/api/v1/developer/apps?developerAccountId=${b.accountId}`)
        .set('Authorization', bearer(a.user))
        .set('X-Developer-Account-Id', b.accountId);
      // Query lạ bị từ chối (strict); header bị bỏ qua.
      expect(res.status).toBe(400);
      const list = await t
        .http()
        .get('/api/v1/developer/apps')
        .set('Authorization', bearer(a.user))
        .set('X-Developer-Account-Id', b.accountId)
        .expect(200);
      expect(list.body.data.map((x: { id: string }) => x.id)).toEqual([a.app.id]);
    });

    it('id sai định dạng → 400; thiếu id ở archive → 404', async () => {
      const { user } = await developerWithApp();
      const bad = await t
        .http()
        .get('/api/v1/developer/apps/123')
        .set('Authorization', bearer(user))
        .expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      await t
        .http()
        .post('/api/v1/developer/apps//archive')
        .set('Authorization', bearer(user))
        .expect(404);
    });
  });

  describe('sửa metadata draft', () => {
    it('sửa được metadata; audit ghi before/after', async () => {
      const { user, app } = await developerWithApp();
      const newCategory = await createCategory(t);
      const res = await t
        .http()
        .patch(`/api/v1/developer/apps/${app.id}`)
        .set('Authorization', bearer(user))
        .send({
          title: 'Tên Mới',
          categoryId: newCategory.id,
          supportUrl: null,
          containsAds: true,
          contentRating: 'teen',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        title: 'Tên Mới',
        category: { id: newCategory.id },
        supportUrl: null,
        containsAds: true,
        contentRating: 'teen',
        packageName: app.packageName,
      });
      const [audit] = await audits(app.id, 'app.update');
      expect(audit).toMatchObject({
        actorId: user.id,
        before: expect.objectContaining({
          supportUrl: 'https://support.example.com',
          containsAds: false,
        }),
        after: expect.objectContaining({ title: 'Tên Mới', supportUrl: null, containsAds: true }),
      });
    });

    it.each([
      ['packageName', { packageName: 'vn.changed.app' }],
      ['developerAccountId', { developerAccountId: randomUUID() }],
      ['status', { status: 'published' }],
      ['slug', { slug: 'hijack' }],
      ['pendingPackageName', { pendingPackageName: 'vn.x.y' }],
      ['currentReleaseId', { currentReleaseId: randomUUID() }],
    ])('mass assignment %s khi sửa → 400, app không đổi', async (_field, extra) => {
      const { user, app } = await developerWithApp();
      const before = await t.prisma.app.findUniqueOrThrow({ where: { id: app.id } });
      const res = await t
        .http()
        .patch(`/api/v1/developer/apps/${app.id}`)
        .set('Authorization', bearer(user))
        .send({ title: 'Tên Hợp Lệ', ...extra })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(await t.prisma.app.findUniqueOrThrow({ where: { id: app.id } })).toEqual(before);
    });

    it('chuyển danh mục sang danh mục ẩn → 400 INVALID_CATEGORY', async () => {
      const { user, app } = await developerWithApp();
      const hidden = await createCategory(t, { isActive: false });
      const res = await t
        .http()
        .patch(`/api/v1/developer/apps/${app.id}`)
        .set('Authorization', bearer(user))
        .send({ categoryId: hidden.id })
        .expect(400);
      expect(res.body.code).toBe('INVALID_CATEGORY');
    });

    it.each(['pending_review', 'published', 'rejected', 'suspended', 'archived'] as const)(
      'app ở %s không sửa metadata được → 409 APP_NOT_EDITABLE',
      async (status) => {
        const { user, app } = await developerWithApp();
        await t.prisma.app.update({
          where: { id: app.id },
          data: { status },
        });
        const res = await t
          .http()
          .patch(`/api/v1/developer/apps/${app.id}`)
          .set('Authorization', bearer(user))
          .send({ title: 'Không Được Sửa' })
          .expect(409);
        expect(res.body.code).toBe('APP_NOT_EDITABLE');
      },
    );

    it('DB chặn chuyển chủ sở hữu và đổi package name ngoài API', async () => {
      const a = await developerWithApp();
      const b = await createDeveloper(t, 'active');
      await expect(
        t.prisma.app.update({ where: { id: a.app.id }, data: { developerAccountId: b.accountId } }),
      ).rejects.toThrow(/developer_account_id is immutable/);
      await expect(
        t.prisma.app.update({ where: { id: a.app.id }, data: { packageName: 'vn.other.name' } }),
      ).rejects.toThrow(/package_name is immutable/);
    });
  });

  describe('vòng đời: archive', () => {
    it('draft → archived; package name được giải phóng và đăng ký lại được', async () => {
      const a = await developerWithApp();
      const res = await t
        .http()
        .post(`/api/v1/developer/apps/${a.app.id}/archive`)
        .set('Authorization', bearer(a.user))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'archived',
        packageName: a.app.packageName,
        packageNameReleased: true,
        capabilities: { canEdit: false, canArchive: false },
      });
      const row = await t.prisma.app.findUniqueOrThrow({ where: { id: a.app.id } });
      expect(row).toMatchObject({ packageName: null, pendingPackageName: a.app.packageName });

      const [audit] = await audits(a.app.id, 'app.archive');
      expect(audit).toMatchObject({
        before: { status: 'draft', packageName: a.app.packageName },
        after: { status: 'archived', packageName: null, packageReleased: true },
      });

      // Mặc định danh sách ẩn app archived; ?status=archived thì thấy.
      const list = await t
        .http()
        .get('/api/v1/developer/apps')
        .set('Authorization', bearer(a.user))
        .expect(200);
      expect(list.body.data).toHaveLength(0);
      const archived = await t
        .http()
        .get('/api/v1/developer/apps?status=archived')
        .set('Authorization', bearer(a.user))
        .expect(200);
      expect(archived.body.data.map((x: { id: string }) => x.id)).toEqual([a.app.id]);

      const b = await createDeveloper(t, 'active');
      expect((await createApp(b.user, { packageName: a.app.packageName })).status).toBe(201);
    });

    it('rejected → archived được', async () => {
      const { user, app } = await developerWithApp();
      await t.prisma.app.update({ where: { id: app.id }, data: { status: 'rejected' } });
      await t
        .http()
        .post(`/api/v1/developer/apps/${app.id}/archive`)
        .set('Authorization', bearer(user))
        .expect(200);
    });

    it.each(['pending_review', 'published', 'suspended', 'archived'] as const)(
      'archive từ %s → 409 INVALID_APP_STATUS_TRANSITION',
      async (status) => {
        const { user, app } = await developerWithApp();
        await t.prisma.app.update({ where: { id: app.id }, data: { status } });
        const res = await t
          .http()
          .post(`/api/v1/developer/apps/${app.id}/archive`)
          .set('Authorization', bearer(user))
          .expect(409);
        expect(res.body.code).toBe('INVALID_APP_STATUS_TRANSITION');
      },
    );

    it('archive hai lần đồng thời → đúng 1 thành công, 1 audit', async () => {
      const { user, app } = await developerWithApp();
      const results = await Promise.all(
        [0, 1].map(() =>
          t
            .http()
            .post(`/api/v1/developer/apps/${app.id}/archive`)
            .set('Authorization', bearer(user)),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await audits(app.id, 'app.archive')).toHaveLength(1);
    });

    it('không có endpoint nào cho developer tự publish/duyệt', async () => {
      const { user, app } = await developerWithApp();
      for (const action of ['publish', 'approve', 'submit', 'status']) {
        const res = await t
          .http()
          .post(`/api/v1/developer/apps/${app.id}/${action}`)
          .set('Authorization', bearer(user))
          .send({ status: 'published' });
        expect(res.status).toBe(404);
      }
      const row = await t.prisma.app.findUniqueOrThrow({ where: { id: app.id } });
      expect(row.status).toBe('draft');
    });
  });

  describe('khóa tài khoản giữa chừng (TOCTOU)', () => {
    /**
     * Context lấy lúc developer còn active, rồi staff khóa tài khoản trước khi service ghi.
     * Gọi thẳng service để vượt qua guard: chỉ `lockForMutation` trong transaction chặn được.
     */
    async function staleContext() {
      const { user, accountId, app } = await developerWithApp();
      const access = t.app.get(DeveloperAccessService);
      const context = await access.resolve(user.id);
      if (!context || context.status !== 'active') throw new Error('expected active context');
      await setDeveloperStatus(t, accountId, 'suspended', 'Khóa giữa chừng');
      const authUser = {
        id: user.id,
        roles: ['user'],
        developerAccounts: [],
      } as unknown as AuthUser;
      return { context, authUser, app, accountId, service: t.app.get(DeveloperAppsService) };
    }
    const audit = { ip: '127.0.0.1', requestId: 'stale-test' };

    it('tạo app bằng context cũ → 403, không tạo gì', async () => {
      const { context, authUser, service, accountId } = await staleContext();
      await expect(
        service.create(authUser, context, appBody(categoryId) as never, audit),
      ).rejects.toMatchObject({ code: 'DEVELOPER_ACCOUNT_NOT_ACTIVE' });
      expect(await t.prisma.app.count({ where: { developerAccountId: accountId } })).toBe(1);
    });

    it('sửa và archive bằng context cũ → 403, app không đổi', async () => {
      const { context, authUser, service, app } = await staleContext();
      const before = await t.prisma.app.findUniqueOrThrow({ where: { id: app.id } });
      await expect(
        service.update(authUser, context, app.id, { title: 'Lọt Qua' }, audit),
      ).rejects.toMatchObject({ code: 'DEVELOPER_ACCOUNT_NOT_ACTIVE' });
      await expect(service.archive(authUser, context, app.id, audit)).rejects.toMatchObject({
        code: 'DEVELOPER_ACCOUNT_NOT_ACTIVE',
      });
      expect(await t.prisma.app.findUniqueOrThrow({ where: { id: app.id } })).toEqual(before);
    });
  });

  describe('danh mục', () => {
    it('GET /categories công khai, chỉ danh mục đang hiển thị', async () => {
      const visible = await createCategory(t);
      const hidden = await createCategory(t, { isActive: false });
      const res = await t.http().get('/api/v1/categories').expect(200);
      const slugs = res.body.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain(visible.slug);
      expect(slugs).not.toContain(hidden.slug);
      expect(res.body[0]).not.toHaveProperty('isActive');
    });

    it('admin tạo, sửa, ẩn, xóa danh mục; có audit', async () => {
      const admin = await t.newStaff('admin');
      const slug = `cat-${randomUUID().slice(0, 8)}`;
      const created = await t
        .http()
        .post('/api/v1/admin/categories')
        .set('Authorization', bearer(admin))
        .send({ slug, nameVi: 'Thử nghiệm', nameEn: 'Testing', icon: 'flask', sortOrder: 5 })
        .expect(201);
      expect(created.body).toMatchObject({ slug, isActive: true, appCount: 0 });

      await t
        .http()
        .post('/api/v1/admin/categories')
        .set('Authorization', bearer(admin))
        .send({ slug, nameVi: 'Trùng', nameEn: 'Dup' })
        .expect(409)
        .expect((r) => expect(r.body.code).toBe('CATEGORY_SLUG_TAKEN'));

      const updated = await t
        .http()
        .patch(`/api/v1/admin/categories/${created.body.id}`)
        .set('Authorization', bearer(admin))
        .send({ nameVi: 'Đã đổi', isActive: false })
        .expect(200);
      expect(updated.body).toMatchObject({ nameVi: 'Đã đổi', isActive: false });

      await t
        .http()
        .patch(`/api/v1/admin/categories/${created.body.id}`)
        .set('Authorization', bearer(admin))
        .send({ slug: 'renamed' })
        .expect(400);

      await t
        .http()
        .delete(`/api/v1/admin/categories/${created.body.id}`)
        .set('Authorization', bearer(admin))
        .expect(204);
      expect(await t.prisma.appCategory.findUnique({ where: { id: created.body.id } })).toBeNull();

      const actions = (
        await t.prisma.auditLog.findMany({
          where: { targetId: created.body.id },
          orderBy: { id: 'asc' },
        })
      ).map((a) => a.action);
      expect(actions).toEqual(['category.create', 'category.update', 'category.delete']);
    });

    it('xóa danh mục đang có app → 409 CATEGORY_IN_USE', async () => {
      const admin = await t.newStaff('admin');
      const category = await createCategory(t);
      const { user } = await createDeveloper(t, 'active');
      expect((await createApp(user, { categoryId: category.id })).status).toBe(201);
      const res = await t
        .http()
        .delete(`/api/v1/admin/categories/${category.id}`)
        .set('Authorization', bearer(admin))
        .expect(409);
      expect(res.body.code).toBe('CATEGORY_IN_USE');
      const list = await t
        .http()
        .get('/api/v1/admin/categories')
        .set('Authorization', bearer(admin))
        .expect(200);
      expect(list.body.find((c: { id: string }) => c.id === category.id)).toMatchObject({
        appCount: 1,
      });
    });

    it('moderator, developer và user thường không quản lý được danh mục', async () => {
      const moderator = await t.newStaff('moderator');
      const { user: developer } = await createDeveloper(t, 'active');
      for (const actor of [moderator, developer]) {
        const res = await t
          .http()
          .post('/api/v1/admin/categories')
          .set('Authorization', bearer(actor))
          .send({ slug: `x-${randomUUID().slice(0, 6)}`, nameVi: 'Xx', nameEn: 'Xx' })
          .expect(403);
        expect(res.body.code).toBe('FORBIDDEN');
      }
    });

    it('admin chưa MFA → 403 MFA_REQUIRED', async () => {
      const admin = await t.newStaff('admin', { aal: 'aal1' });
      const res = await t
        .http()
        .get('/api/v1/admin/categories')
        .set('Authorization', bearer(admin))
        .expect(403);
      expect(res.body.code).toBe('MFA_REQUIRED');
    });
  });

  describe('OpenAPI', () => {
    it('mô tả các endpoint Phase 2B', async () => {
      const res = await t.http().get('/api/openapi.json').expect(200);
      expect(Object.keys(res.body.paths)).toEqual(
        expect.arrayContaining([
          '/api/v1/developer/apps',
          '/api/v1/developer/apps/{appId}',
          '/api/v1/developer/apps/{appId}/archive',
          '/api/v1/categories',
          '/api/v1/admin/categories',
          '/api/v1/admin/categories/{categoryId}',
        ]),
      );
      expect(res.body.components.schemas.CreateAppRequest).toMatchObject({
        additionalProperties: false,
        required: expect.arrayContaining(['packageName', 'categoryId', 'supportEmail']),
      });
    });
  });
});
