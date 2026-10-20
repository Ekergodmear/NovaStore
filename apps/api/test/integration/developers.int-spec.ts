import { randomUUID } from 'node:crypto';
import { DeveloperAccessService } from '../../src/developers/developer-access.service';
import { createIntegrationApp, developerBody, type IntegrationApp, type TestUser } from './harness';

const bearer = (user: TestUser) => `Bearer ${user.token}`;

describe('Developer identity & ownership (integration, Postgres thật)', () => {
  let t: IntegrationApp;

  beforeAll(async () => {
    t = await createIntegrationApp();
  }, 120_000);

  afterAll(async () => {
    await t?.close();
  });

  /** Đăng ký developer cho user mới; trả về user và id account. */
  async function registerDeveloper(overrides: Record<string, unknown> = {}) {
    const user = await t.newUser();
    const res = await t
      .http()
      .post('/api/v1/developers')
      .set('Authorization', bearer(user))
      .send(developerBody(overrides))
      .expect(201);
    return { user, accountId: res.body.id as string, body: res.body };
  }

  /** Staff (admin, MFA) chuyển trạng thái developer. */
  async function setStatus(accountId: string, status: string, reason?: string) {
    const admin = await t.newStaff('admin');
    return t
      .http()
      .post(`/api/v1/admin/developers/${accountId}/status`)
      .set('Authorization', bearer(admin))
      .send(reason ? { status, reason } : { status });
  }

  async function auditFor(targetId: string, action: string) {
    return t.prisma.auditLog.findMany({ where: { targetId, action }, orderBy: { id: 'asc' } });
  }

  describe('xác thực', () => {
    it.each([
      ['post', '/api/v1/developers'],
      ['get', '/api/v1/developers/me'],
      ['patch', '/api/v1/developers/me'],
      ['get', '/api/v1/developers/me/status'],
      ['get', `/api/v1/developer/accounts/${randomUUID()}`],
      ['get', '/api/v1/admin/developers'],
    ] as const)('%s %s không có token → 401', async (method, path) => {
      const res = await t.http()[method](path).send({});
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('user chưa có developer account', () => {
    it.each([
      ['get', '/api/v1/developers/me'],
      ['patch', '/api/v1/developers/me'],
      ['get', '/api/v1/developers/me/status'],
      ['get', `/api/v1/developer/accounts/${randomUUID()}`],
    ] as const)('%s %s → 403 DEVELOPER_ACCOUNT_REQUIRED', async (method, path) => {
      const user = await t.newUser();
      const client = t.http();
      const res = await client[method](path)
        .set('Authorization', bearer(user))
        .send({ displayName: 'X Studio' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('DEVELOPER_ACCOUNT_REQUIRED');
    });

    it('user thường không gọi được API staff → 403 FORBIDDEN', async () => {
      const user = await t.newUser({ aal: 'aal2' });
      const res = await t.http().get('/api/v1/admin/developers').set('Authorization', bearer(user));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('đăng ký', () => {
    it('tạo account pending, user là owner, ghi audit trong DB', async () => {
      const { user, accountId, body } = await registerDeveloper();

      expect(body).toMatchObject({
        status: 'pending',
        memberRole: 'owner',
        verificationStatus: 'unverified',
        agreementVersion: '2026-10',
        statusReason: null,
        capabilities: { canManageProfile: true, canPublish: false },
      });

      const member = await t.prisma.developerMember.findUnique({ where: { userId: user.id } });
      expect(member).toMatchObject({ developerAccountId: accountId, memberRole: 'owner' });

      const [audit] = await auditFor(accountId, 'developer.register');
      expect(audit).toMatchObject({
        actorId: user.id,
        targetType: 'developer_account',
        after: expect.objectContaining({ status: 'pending' }),
      });
      expect(audit?.ipHash).toMatch(/^[a-f0-9]{64}$/);
      expect(audit?.requestId).toEqual(expect.any(String));
    });

    it('đăng ký lần hai → 409 DEVELOPER_ACCOUNT_EXISTS, DB vẫn chỉ một account', async () => {
      const { user } = await registerDeveloper();
      const res = await t
        .http()
        .post('/api/v1/developers')
        .set('Authorization', bearer(user))
        .send(developerBody())
        .expect(409);
      expect(res.body.code).toBe('DEVELOPER_ACCOUNT_EXISTS');
      expect(await t.prisma.developerMember.count({ where: { userId: user.id } })).toBe(1);
    });

    it('6 request đăng ký đồng thời của cùng user → đúng 1 thành công', async () => {
      const user = await t.newUser();
      const bodies = Array.from({ length: 6 }, () => developerBody());
      const results = await Promise.all(
        bodies.map((body) =>
          t.http().post('/api/v1/developers').set('Authorization', bearer(user)).send(body),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409, 409]);
      for (const r of results.filter((r) => r.status === 409)) {
        expect(r.body.code).toBe('DEVELOPER_ACCOUNT_EXISTS');
      }
      expect(await t.prisma.developerMember.count({ where: { userId: user.id } })).toBe(1);
      // Transaction thua cuộc rollback trọn vẹn: không còn account mồ côi không có thành viên.
      const created = await t.prisma.developerAccount.count({
        where: { slug: { in: bodies.map((b) => b.slug) } },
      });
      expect(created).toBe(1);
    });

    it('nhiều user cùng lấy một slug đồng thời → đúng 1 thành công', async () => {
      const slug = `race-${randomUUID().slice(0, 8)}`;
      const users = await Promise.all(Array.from({ length: 4 }, () => t.newUser()));
      const results = await Promise.all(
        users.map((user) =>
          t
            .http()
            .post('/api/v1/developers')
            .set('Authorization', bearer(user))
            .send(developerBody({ slug })),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      for (const r of results.filter((r) => r.status !== 201)) {
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('DEVELOPER_SLUG_TAKEN');
      }
      expect(await t.prisma.developerAccount.count({ where: { slug } })).toBe(1);
    });

    it('slug trùng không phân biệt hoa thường (citext)', async () => {
      const { body } = await registerDeveloper();
      const other = await t.newUser();
      const res = await t
        .http()
        .post('/api/v1/developers')
        .set('Authorization', bearer(other))
        .send(developerBody({ slug: body.slug.toUpperCase() }))
        .expect(409);
      expect(res.body.code).toBe('DEVELOPER_SLUG_TAKEN');
    });

    it('sai phiên bản Developer Agreement → 400', async () => {
      const user = await t.newUser();
      const res = await t
        .http()
        .post('/api/v1/developers')
        .set('Authorization', bearer(user))
        .send(developerBody({ agreementVersion: '2020-01' }))
        .expect(400);
      expect(res.body.code).toBe('AGREEMENT_VERSION_MISMATCH');
    });

    it.each(['me', 'admin', 'novastore'])('slug dành riêng "%s" → 400', async (slug) => {
      const user = await t.newUser();
      const res = await t
        .http()
        .post('/api/v1/developers')
        .set('Authorization', bearer(user))
        .send(developerBody({ slug }))
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('mass assignment & giả mạo danh tính', () => {
    it.each([
      ['userId', { userId: randomUUID() }],
      ['ownerUserId', { ownerUserId: randomUUID() }],
      ['developerAccountId', { developerAccountId: randomUUID() }],
      ['status', { status: 'active' }],
      ['verificationStatus', { verificationStatus: 'verified' }],
      ['memberRole', { memberRole: 'owner' }],
    ])('đăng ký kèm %s → 400, không tạo gì', async (_field, extra) => {
      const user = await t.newUser();
      const res = await t
        .http()
        .post('/api/v1/developers')
        .set('Authorization', bearer(user))
        .send(developerBody(extra))
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(await t.prisma.developerMember.count({ where: { userId: user.id } })).toBe(0);
    });

    it.each([
      ['status', { status: 'active' }],
      ['statusReason', { statusReason: 'x' }],
      ['slug', { slug: 'new-slug' }],
      ['verificationStatus', { verificationStatus: 'verified' }],
      ['agreementVersion', { agreementVersion: '2026-10' }],
      ['id', { id: randomUUID() }],
    ])('PATCH /me kèm %s → 400, dữ liệu không đổi', async (_field, extra) => {
      const { user, accountId } = await registerDeveloper();
      const before = await t.prisma.developerAccount.findUniqueOrThrow({
        where: { id: accountId },
      });
      const res = await t
        .http()
        .patch('/api/v1/developers/me')
        .set('Authorization', bearer(user))
        .send({ displayName: 'Hacked Studio', ...extra })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      const after = await t.prisma.developerAccount.findUniqueOrThrow({ where: { id: accountId } });
      expect(after).toEqual(before);
    });

    it('header/query giả danh tính bị bỏ qua: /me luôn là của người gọi', async () => {
      const a = await registerDeveloper();
      const b = await registerDeveloper();
      const res = await t
        .http()
        .get(`/api/v1/developers/me?userId=${b.user.id}&developerAccountId=${b.accountId}`)
        .set('Authorization', bearer(a.user))
        .set('X-User-Id', b.user.id)
        .set('X-Developer-Account-Id', b.accountId)
        .expect(200);
      expect(res.body.id).toBe(a.accountId);
    });
  });

  describe('đọc và sửa hồ sơ của chính mình', () => {
    it('GET /me và GET /developer/accounts/:id trả hồ sơ riêng tư', async () => {
      const { user, accountId, body } = await registerDeveloper();
      const me = await t
        .http()
        .get('/api/v1/developers/me')
        .set('Authorization', bearer(user))
        .expect(200);
      expect(me.body).toEqual(body);
      const byId = await t
        .http()
        .get(`/api/v1/developer/accounts/${accountId}`)
        .set('Authorization', bearer(user))
        .expect(200);
      expect(byId.body.contactEmail).toBe(body.contactEmail);
    });

    it('PATCH /me cập nhật và ghi audit before/after', async () => {
      const { user, accountId } = await registerDeveloper();
      const res = await t
        .http()
        .patch('/api/v1/developers/me')
        .set('Authorization', bearer(user))
        .send({ displayName: 'Studio Mới', website: null })
        .expect(200);
      expect(res.body).toMatchObject({ displayName: 'Studio Mới', website: null });

      const [audit] = await auditFor(accountId, 'developer.update');
      expect(audit).toMatchObject({
        actorId: user.id,
        before: expect.objectContaining({ website: 'https://studio.example.com' }),
        after: expect.objectContaining({ displayName: 'Studio Mới', website: null }),
      });
    });

    it('editor của account xem được nhưng không sửa được hồ sơ', async () => {
      const { accountId } = await registerDeveloper();
      const editor = await t.newUser();
      await t.prisma.user.create({ data: { id: editor.id, email: editor.email } });
      await t.prisma.developerMember.create({
        data: { developerAccountId: accountId, userId: editor.id, memberRole: 'editor' },
      });

      await t.http().get('/api/v1/developers/me').set('Authorization', bearer(editor)).expect(200);
      const res = await t
        .http()
        .patch('/api/v1/developers/me')
        .set('Authorization', bearer(editor))
        .send({ displayName: 'Editor Edit' })
        .expect(403);
      expect(res.body.code).toBe('DEVELOPER_ROLE_INSUFFICIENT');
    });
  });

  describe('IDOR: developer A với tài nguyên của developer B', () => {
    it('đọc account của B → 404 giống hệt id không tồn tại', async () => {
      const a = await registerDeveloper();
      const b = await registerDeveloper();

      const foreign = await t
        .http()
        .get(`/api/v1/developer/accounts/${b.accountId}`)
        .set('Authorization', bearer(a.user))
        .expect(404);
      const missing = await t
        .http()
        .get(`/api/v1/developer/accounts/${randomUUID()}`)
        .set('Authorization', bearer(a.user))
        .expect(404);

      const strip = (body: Record<string, unknown>) => ({ ...body, requestId: undefined });
      expect(strip(foreign.body)).toEqual(strip(missing.body));
      expect(JSON.stringify(foreign.body)).not.toContain(b.body.contactEmail);
    });

    it('sửa account của B → 404 và dữ liệu của B không đổi', async () => {
      const a = await registerDeveloper();
      const b = await registerDeveloper();
      const before = await t.prisma.developerAccount.findUniqueOrThrow({
        where: { id: b.accountId },
      });

      await t
        .http()
        .patch(`/api/v1/developer/accounts/${b.accountId}`)
        .set('Authorization', bearer(a.user))
        .send({ displayName: 'Pwned Studio' })
        .expect(404);

      const after = await t.prisma.developerAccount.findUniqueOrThrow({
        where: { id: b.accountId },
      });
      expect(after).toEqual(before);
      expect(await auditFor(b.accountId, 'developer.update')).toHaveLength(0);
    });

    it('A bị suspended vẫn nhận 404 (không phải 403) với id của B', async () => {
      const a = await registerDeveloper();
      const b = await registerDeveloper();
      await setStatus(a.accountId, 'active').then((r) => expect(r.status).toBe(200));
      await setStatus(a.accountId, 'suspended', 'Vi phạm chính sách').then((r) =>
        expect(r.status).toBe(200),
      );
      await t
        .http()
        .patch(`/api/v1/developer/accounts/${b.accountId}`)
        .set('Authorization', bearer(a.user))
        .send({ displayName: 'X Studio' })
        .expect(404);
    });
  });

  describe('định danh thiếu hoặc sai', () => {
    it.each(['not-a-uuid', '123', '00000000-0000-0000-0000-00000000000g'])(
      'GET /developer/accounts/%s → 400 VALIDATION_FAILED',
      async (id) => {
        const { user } = await registerDeveloper();
        const res = await t
          .http()
          .get(`/api/v1/developer/accounts/${id}`)
          .set('Authorization', bearer(user))
          .expect(400);
        expect(res.body.code).toBe('VALIDATION_FAILED');
      },
    );

    it('thiếu id (GET /developer/accounts/) → 404', async () => {
      const { user } = await registerDeveloper();
      await t
        .http()
        .get('/api/v1/developer/accounts/')
        .set('Authorization', bearer(user))
        .expect(404);
    });

    it('staff đổi trạng thái id không tồn tại → 404; id sai định dạng → 400', async () => {
      const admin = await t.newStaff('admin');
      await t
        .http()
        .post(`/api/v1/admin/developers/${randomUUID()}/status`)
        .set('Authorization', bearer(admin))
        .send({ status: 'active' })
        .expect(404);
      await t
        .http()
        .post('/api/v1/admin/developers/abc/status')
        .set('Authorization', bearer(admin))
        .send({ status: 'active' })
        .expect(400);
    });
  });

  describe('vòng đời trạng thái (chỉ staff)', () => {
    it('pending → active: moderator duyệt, audit ghi before/after', async () => {
      const { user, accountId } = await registerDeveloper();
      const moderator = await t.newStaff('moderator');
      const res = await t
        .http()
        .post(`/api/v1/admin/developers/${accountId}/status`)
        .set('Authorization', bearer(moderator))
        .send({ status: 'active' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'active',
        allowedTransitions: ['suspended', 'banned'],
      });

      const status = await t
        .http()
        .get('/api/v1/developers/me/status')
        .set('Authorization', bearer(user))
        .expect(200);
      expect(status.body).toMatchObject({
        status: 'active',
        capabilities: { canManageProfile: true, canPublish: true },
      });

      const [audit] = await auditFor(accountId, 'developer.status.change');
      expect(audit).toMatchObject({
        actorId: moderator.id,
        actorRole: 'moderator',
        before: { status: 'pending', statusReason: null },
        after: { status: 'active', statusReason: null },
      });
    });

    it.each([
      ['pending', 'suspended'],
      ['pending', 'banned'],
      ['pending', 'pending'],
    ])('chuyển không hợp lệ %s → %s → 409', async (_from, to) => {
      const { accountId } = await registerDeveloper();
      const res = await setStatus(accountId, to, 'Lý do kiểm thử');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejected và banned là trạng thái kết thúc', async () => {
      const rejected = await registerDeveloper();
      expect((await setStatus(rejected.accountId, 'rejected', 'Thiếu thông tin')).status).toBe(200);
      expect((await setStatus(rejected.accountId, 'active')).body.code).toBe(
        'INVALID_STATUS_TRANSITION',
      );

      const banned = await registerDeveloper();
      await setStatus(banned.accountId, 'active');
      expect((await setStatus(banned.accountId, 'banned', 'Phát tán malware')).status).toBe(200);
      expect((await setStatus(banned.accountId, 'active')).body.code).toBe(
        'INVALID_STATUS_TRANSITION',
      );
    });

    it('duyệt hai lần (active → active) → 409, chỉ một audit', async () => {
      const { accountId } = await registerDeveloper();
      expect((await setStatus(accountId, 'active')).status).toBe(200);
      expect((await setStatus(accountId, 'active')).status).toBe(409);
      expect(await auditFor(accountId, 'developer.status.change')).toHaveLength(1);
    });

    it('rejected/suspended/banned bắt buộc có lý do → 400', async () => {
      const { accountId } = await registerDeveloper();
      const res = await setStatus(accountId, 'rejected');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('moderator không được ban; admin được', async () => {
      const { accountId } = await registerDeveloper();
      await setStatus(accountId, 'active');
      const moderator = await t.newStaff('moderator');
      const res = await t
        .http()
        .post(`/api/v1/admin/developers/${accountId}/status`)
        .set('Authorization', bearer(moderator))
        .send({ status: 'banned', reason: 'Malware' })
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect((await setStatus(accountId, 'banned', 'Malware')).status).toBe(200);
    });

    it('developer không tự đổi được trạng thái của mình', async () => {
      const { user, accountId } = await registerDeveloper();
      const self = await t
        .http()
        .post(`/api/v1/admin/developers/${accountId}/status`)
        .set('Authorization', bearer(user))
        .send({ status: 'active' })
        .expect(403);
      expect(self.body.code).toBe('FORBIDDEN');
      const viaPatch = await t
        .http()
        .patch('/api/v1/developers/me')
        .set('Authorization', bearer(user))
        .send({ status: 'active' })
        .expect(400);
      expect(viaPatch.body.code).toBe('VALIDATION_FAILED');
      const row = await t.prisma.developerAccount.findUniqueOrThrow({ where: { id: accountId } });
      expect(row.status).toBe('pending');
    });

    it('staff không được duyệt account mà chính mình là thành viên', async () => {
      const staff = await t.newStaff('admin');
      const reg = await t
        .http()
        .post('/api/v1/developers')
        .set('Authorization', bearer(staff))
        .send(developerBody())
        .expect(201);
      const res = await t
        .http()
        .post(`/api/v1/admin/developers/${reg.body.id}/status`)
        .set('Authorization', bearer(staff))
        .send({ status: 'active' })
        .expect(403);
      expect(res.body.code).toBe('CONFLICT_OF_INTEREST');
    });

    it('staff chưa MFA (aal1) → 403 MFA_REQUIRED, trạng thái không đổi', async () => {
      const { accountId } = await registerDeveloper();
      const admin = await t.newStaff('admin', { aal: 'aal1' });
      const res = await t
        .http()
        .post(`/api/v1/admin/developers/${accountId}/status`)
        .set('Authorization', bearer(admin))
        .send({ status: 'active' })
        .expect(403);
      expect(res.body.code).toBe('MFA_REQUIRED');
      const row = await t.prisma.developerAccount.findUniqueOrThrow({ where: { id: accountId } });
      expect(row.status).toBe('pending');
    });

    it('MFA staff vẫn áp dụng cho route Phase 1 (/admin/dashboard)', async () => {
      const admin = await t.newStaff('admin', { aal: 'aal1' });
      const res = await t
        .http()
        .get('/api/v1/admin/dashboard')
        .set('Authorization', bearer(admin))
        .expect(403);
      expect(res.body.code).toBe('MFA_REQUIRED');
    });

    it('danh sách staff lọc theo trạng thái và phân trang', async () => {
      await registerDeveloper();
      await registerDeveloper();
      const admin = await t.newStaff('admin');
      const page1 = await t
        .http()
        .get('/api/v1/admin/developers?status=pending&limit=1')
        .set('Authorization', bearer(admin))
        .expect(200);
      expect(page1.body.data).toHaveLength(1);
      expect(page1.body.data[0].status).toBe('pending');
      expect(page1.body.nextCursor).toEqual(expect.any(String));
      const page2 = await t
        .http()
        .get(`/api/v1/admin/developers?status=pending&limit=1&cursor=${page1.body.nextCursor}`)
        .set('Authorization', bearer(admin))
        .expect(200);
      expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
      await t
        .http()
        .get('/api/v1/admin/developers?status=bogus')
        .set('Authorization', bearer(admin))
        .expect(400);
    });
  });

  describe('developer bị khóa', () => {
    it.each([
      ['suspended', 'Vi phạm chính sách'],
      ['banned', 'Phát tán malware'],
    ])('%s: vẫn xem được trạng thái + lý do, không sửa được hồ sơ', async (status, reason) => {
      const { user, accountId } = await registerDeveloper();
      await setStatus(accountId, 'active');
      expect((await setStatus(accountId, status, reason)).status).toBe(200);

      const me = await t
        .http()
        .get('/api/v1/developers/me/status')
        .set('Authorization', bearer(user))
        .expect(200);
      expect(me.body).toMatchObject({
        status,
        statusReason: reason,
        capabilities: { canManageProfile: false, canPublish: false },
      });

      const res = await t
        .http()
        .patch('/api/v1/developers/me')
        .set('Authorization', bearer(user))
        .send({ displayName: 'Still Here' })
        .expect(403);
      expect(res.body.code).toBe('DEVELOPER_ACCOUNT_NOT_ACTIVE');
    });

    it('rejected: không sửa được hồ sơ', async () => {
      const { user, accountId } = await registerDeveloper();
      await setStatus(accountId, 'rejected', 'Thông tin không hợp lệ');
      const res = await t
        .http()
        .patch('/api/v1/developers/me')
        .set('Authorization', bearer(user))
        .send({ displayName: 'Retry Studio' })
        .expect(403);
      expect(res.body.code).toBe('DEVELOPER_ACCOUNT_NOT_ACTIVE');
    });

    it('khôi phục suspended → active mở lại quyền sửa', async () => {
      const { user, accountId } = await registerDeveloper();
      await setStatus(accountId, 'active');
      await setStatus(accountId, 'suspended', 'Tạm khóa kiểm tra');
      expect((await setStatus(accountId, 'active')).status).toBe(200);
      await t
        .http()
        .patch('/api/v1/developers/me')
        .set('Authorization', bearer(user))
        .send({ displayName: 'Back Studio' })
        .expect(200);
    });
  });

  describe('DeveloperAccessService (capability publish cho Phase 2B)', () => {
    it('chỉ developer active có quyền publish', async () => {
      const access = t.app.get(DeveloperAccessService);
      const { user, accountId } = await registerDeveloper();
      const authUser = { id: user.id } as Parameters<DeveloperAccessService['require']>[0];

      await expect(access.require(authUser, 'publish')).rejects.toMatchObject({
        code: 'DEVELOPER_ACCOUNT_NOT_ACTIVE',
      });
      await setStatus(accountId, 'active');
      await expect(access.require(authUser, 'publish')).resolves.toMatchObject({
        accountId,
        status: 'active',
      });
      await setStatus(accountId, 'suspended', 'Kiểm tra');
      await expect(access.require(authUser, 'publish')).rejects.toMatchObject({
        code: 'DEVELOPER_ACCOUNT_NOT_ACTIVE',
      });
    });

    it('ownedWhere giới hạn truy vấn trong account hiện tại', async () => {
      const access = t.app.get(DeveloperAccessService);
      const { user, accountId } = await registerDeveloper();
      const context = await access.resolve(user.id);
      expect(context && access.ownedWhere(context)).toEqual({ developerAccountId: accountId });
    });
  });

  describe('hồ sơ công khai', () => {
    it('chỉ developer active hiển thị, không lộ email liên hệ', async () => {
      const { accountId, body } = await registerDeveloper();
      await t.http().get(`/api/v1/developers/${body.slug}`).expect(404);
      await setStatus(accountId, 'active');
      const res = await t.http().get(`/api/v1/developers/${body.slug}`).expect(200);
      expect(res.body).toEqual({
        slug: body.slug,
        displayName: body.displayName,
        website: body.website,
        verified: false,
      });
    });

    it('slug sai định dạng → 404', async () => {
      await t.http().get('/api/v1/developers/--bad--').expect(404);
    });
  });

  describe('toàn vẹn audit log', () => {
    it('audit_logs vẫn append-only ở tầng DB', async () => {
      const { accountId } = await registerDeveloper();
      await expect(
        t.prisma.auditLog.deleteMany({ where: { targetId: accountId } }),
      ).rejects.toThrow(/append-only/);
      await expect(
        t.prisma.auditLog.updateMany({
          where: { targetId: accountId },
          data: { action: 'tampered' },
        }),
      ).rejects.toThrow(/append-only/);
    });
  });

  describe('OpenAPI', () => {
    it('/api/openapi.json mô tả các endpoint developer', async () => {
      const res = await t.http().get('/api/openapi.json').expect(200);
      expect(Object.keys(res.body.paths)).toEqual(
        expect.arrayContaining([
          '/api/v1/developers',
          '/api/v1/developers/me',
          '/api/v1/developers/me/status',
          '/api/v1/developers/{slug}',
          '/api/v1/developer/accounts/{developerAccountId}',
          '/api/v1/admin/developers',
          '/api/v1/admin/developers/{developerAccountId}',
          '/api/v1/admin/developers/{developerAccountId}/status',
        ]),
      );
      expect(res.body.components.schemas.CreateDeveloperRequest).toMatchObject({
        additionalProperties: false,
        required: expect.arrayContaining(['slug', 'agreementVersion']),
      });
      expect(res.body.components.securitySchemes.bearer).toMatchObject({ scheme: 'bearer' });
    });
  });
});
