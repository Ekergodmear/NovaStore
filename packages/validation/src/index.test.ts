import { describe, expect, it } from 'vitest';
import { createDeveloperSchema, packageNameSchema, slugSchema, updateMeSchema } from './index';

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
