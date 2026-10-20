import { describe, expect, it } from 'vitest';
import {
  APP_DEVELOPER_TRANSITIONS,
  APP_STATUSES,
  DEVELOPER_STATUSES,
  DEVELOPER_STATUS_TRANSITIONS,
  isAppDeveloperTransitionAllowed,
  isDeveloperStatusTransitionAllowed,
  type AppStatus,
  type DeveloperStatus,
} from '@novastore/types';
import {
  changeDeveloperStatusSchema,
  createAppSchema,
  createCategorySchema,
  createDeveloperSchema,
  isReservedPackageName,
  updateAppSchema,
  updateCategorySchema,
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

describe('app schemas (Phase 2B)', () => {
  const valid = {
    packageName: 'vn.acme.notes',
    title: 'Acme Notes',
    shortDescription: 'Ghi chú nhanh và gọn',
    fullDescription: 'Ứng dụng ghi chú đồng bộ đám mây cho mọi người.',
    categoryId: '0199f0a2-0000-7000-8000-000000000001',
    supportEmail: 'support@acme.vn',
  };

  it('chấp nhận dữ liệu hợp lệ tối thiểu', () => {
    expect(createAppSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['developerAccountId', 'status', 'slug', 'id', 'currentReleaseId', 'ratingAvg'])(
    'createAppSchema từ chối trường %s (mass assignment)',
    (field) => {
      expect(createAppSchema.safeParse({ ...valid, [field]: 'x' }).success).toBe(false);
    },
  );

  it.each([
    ['packageName', 'notapackage'],
    ['title', 'x'],
    ['shortDescription', 'ngắn'],
    ['fullDescription', 'x'.repeat(4001)],
    ['privacyPolicyUrl', 'http://acme.vn/privacy'],
    ['categoryId', 'not-a-uuid'],
    ['supportEmail', 'nope'],
    ['contentRating', 'adults'],
    ['defaultLocale', 'fr'],
  ])('createAppSchema từ chối %s=%s', (field, value) => {
    expect(createAppSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it('updateAppSchema: rỗng, packageName, status → lỗi; null cho URL được phép', () => {
    expect(updateAppSchema.safeParse({}).success).toBe(false);
    expect(updateAppSchema.safeParse({ packageName: 'vn.x.y' }).success).toBe(false);
    expect(updateAppSchema.safeParse({ status: 'published' }).success).toBe(false);
    expect(updateAppSchema.safeParse({ supportUrl: null, privacyPolicyUrl: null }).success).toBe(
      true,
    );
    expect(updateAppSchema.safeParse({ supportEmail: null }).success).toBe(false);
  });

  it.each([
    ['com.google.android.youtube', true],
    ['android', true],
    ['androidx.core', true],
    ['COM.GOOGLE.x', true],
    ['vn.novastore.store', true],
    ['com.googleplus.app', false],
    ['vn.acme.notes', false],
  ])('isReservedPackageName(%s) = %s', (name, expected) => {
    expect(isReservedPackageName(name)).toBe(expected);
  });

  it('category schemas', () => {
    expect(
      createCategorySchema.safeParse({ slug: 'tools', nameVi: 'Công cụ', nameEn: 'Tools' }).success,
    ).toBe(true);
    expect(
      createCategorySchema.safeParse({ slug: 'tools', nameVi: 'Cc', nameEn: 'Tt', isActive: false })
        .success,
    ).toBe(false);
    expect(
      createCategorySchema.safeParse({
        slug: 'tools',
        nameVi: 'Cc',
        nameEn: 'Tt',
        icon: 'Bad Icon',
      }).success,
    ).toBe(false);
    expect(updateCategorySchema.safeParse({ slug: 'renamed' }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe('APP_DEVELOPER_TRANSITIONS', () => {
  it('developer chỉ được archive từ draft hoặc rejected', () => {
    const all = APP_STATUSES.flatMap((from) =>
      APP_STATUSES.map((to) => [from, to] as [AppStatus, AppStatus]),
    );
    const actual = all.filter(([from, to]) => isAppDeveloperTransitionAllowed(from, to));
    expect(actual).toEqual([
      ['draft', 'archived'],
      ['rejected', 'archived'],
    ]);
    expect(APP_DEVELOPER_TRANSITIONS.archived).toEqual([]);
  });
});
