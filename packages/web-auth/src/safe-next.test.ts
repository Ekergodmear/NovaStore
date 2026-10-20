import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    ['/', '/'],
    ['/apps', '/apps'],
    ['/apps/new?step=2#media', '/apps/new?step=2#media'],
    ['/%5Cevil.com', '/%5Cevil.com'],
  ])('giữ đường dẫn nội bộ %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    ['//evil.com'],
    ['/\\evil.com'],
    ['/\\/evil.com'],
    ['\\\\evil.com'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['evil.com'],
    [''],
  ])('chặn %j và trả về /', (input) => {
    expect(safeNext(input)).toBe('/');
  });

  it('trả về / khi thiếu giá trị', () => {
    expect(safeNext(undefined)).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
