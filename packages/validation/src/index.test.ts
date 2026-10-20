import { describe, expect, it } from 'vitest';
import {
  DEVELOPER_STATUSES,
  DEVELOPER_STATUS_TRANSITIONS,
  isDeveloperStatusTransitionAllowed,
  type DeveloperStatus,
} from '@novastore/types';
import {
  changeDeveloperStatusSchema,
  createDeveloperSchema,
  packageNameSchema,
  slugSchema,
  updateDeveloperSchema,
  updateMeSchema,
  uuidSchema,
} from './index';

describe('slugSchema', () => {
  it('chấp nhận slug hợp lệ và chuẩn hóa chữ thường', () => {
    expect(slugSchema.parse('Acme-Studio')).toBe('acme-studio');
  });

  it.each(['ab', '-acme', 'acme-', 'acme_studio', 'a'.repeat(41)])('từ chối %s', (value) => {
    expect(slugSchema.safeParse(value).success).toBe(false);
  });
});

describe('packageNameSchema', () => {
  it.each(['vn.acme.notes', 'com.example.app_2'])('chấp nhận %s', (value) => {
    expect(packageNameSchema.safeParse(value).success).toBe(true);
  });

  it.each(['notes', 'vn..acme', '1vn.acme', 'vn.acme.', 'vn.acme-notes'])('từ chối %s', (value) => {
    expect(packageNameSchema.safeParse(value).success).toBe(false);
  });
});

describe('updateMeSchema', () => {
  it('từ chối body rỗng', () => {
    expect(updateMeSchema.safeParse({}).success).toBe(false);
  });

  it('từ chối trường lạ', () => {
    expect(updateMeSchema.safeParse({ displayName: 'A', role: 'admin' }).success).toBe(false);
  });

  it('chỉ chấp nhận avatar https', () => {
    expect(updateMeSchema.safeParse({ avatarUrl: 'http://x.vn/a.png' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ avatarUrl: 'https://x.vn/a.png' }).success).toBe(true);
  });
});

describe('createDeveloperSchema', () => {
  it('chấp nhận dữ liệu hợp lệ', () => {
    const result = createDeveloperSchema.safeParse({
      slug: 'acme-studio',
      displayName: 'Acme Studio',
      contactEmail: 'dev@acme.vn',
      agreementVersion: '2026-10',
    });
    expect(result.success).toBe(true);
  });
});

describe('developer schemas (Phase 2A)', () => {
  const valid = {
    slug: 'acme-studio',
    displayName: 'Acme Studio',
    contactEmail: 'dev@acme.vn',
    agreementVersion: '2026-10',
  };

  it.each(['me', 'admin', 'novastore'])(
    'createDeveloperSchema từ chối slug dành riêng %s',
    (slug) => {
      expect(createDeveloperSchema.safeParse({ ...valid, slug }).success).toBe(false);
    },
  );

  it.each(['userId', 'ownerUserId', 'status', 'verificationStatus', 'memberRole'])(
    'createDeveloperSchema từ chối trường %s (mass assignment)',
    (field) => {
      expect(createDeveloperSchema.safeParse({ ...valid, [field]: 'x' }).success).toBe(false);
    },
  );

  it('createDeveloperSchema chỉ nhận website https', () => {
    expect(createDeveloperSchema.safeParse({ ...valid, website: 'http://a.vn' }).success).toBe(
      false,
    );
    expect(createDeveloperSchema.safeParse({ ...valid, website: 'https://a.vn' }).success).toBe(
      true,
    );
  });

  it('updateDeveloperSchema: rỗng hoặc trường cấm → lỗi; website null được phép', () => {
    expect(updateDeveloperSchema.safeParse({}).success).toBe(false);
    expect(updateDeveloperSchema.safeParse({ slug: 'new-slug' }).success).toBe(false);
    expect(updateDeveloperSchema.safeParse({ status: 'active' }).success).toBe(false);
    expect(updateDeveloperSchema.safeParse({ website: null }).success).toBe(true);
  });

  it.each(['rejected', 'suspended', 'banned'])(
    'changeDeveloperStatusSchema: %s bắt buộc lý do',
    (status) => {
      expect(changeDeveloperStatusSchema.safeParse({ status }).success).toBe(false);
      expect(changeDeveloperStatusSchema.safeParse({ status, reason: 'Vi phạm' }).success).toBe(
        true,
      );
    },
  );

  it('changeDeveloperStatusSchema: active không cần lý do, trạng thái lạ bị từ chối', () => {
    expect(changeDeveloperStatusSchema.safeParse({ status: 'active' }).success).toBe(true);
    expect(changeDeveloperStatusSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('uuidSchema', () => {
    expect(uuidSchema.safeParse('0199f0a2-0000-7000-8000-000000000001').success).toBe(true);
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('DEVELOPER_STATUS_TRANSITIONS', () => {
  const allowed: Array<[DeveloperStatus, DeveloperStatus]> = [
    ['pending', 'active'],
    ['pending', 'rejected'],
    ['active', 'suspended'],
    ['active', 'banned'],
    ['suspended', 'active'],
    ['suspended', 'banned'],
  ];

  it('đúng tập chuyển hợp lệ, không hơn không kém', () => {
    const all = DEVELOPER_STATUSES.flatMap((from) =>
      DEVELOPER_STATUSES.map((to) => [from, to] as [DeveloperStatus, DeveloperStatus]),
    );
    const actual = all.filter(([from, to]) => isDeveloperStatusTransitionAllowed(from, to));
    expect(actual).toEqual(allowed);
  });

  it('banned và rejected là trạng thái kết thúc', () => {
    expect(DEVELOPER_STATUS_TRANSITIONS.banned).toEqual([]);
    expect(DEVELOPER_STATUS_TRANSITIONS.rejected).toEqual([]);
  });
});
