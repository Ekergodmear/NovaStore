import { UnsecuredJWT } from 'jose';
import {
  createTestKeys,
  signHsToken,
  signToken,
  TEST_HS_SECRET,
  testEnv,
  type TestKeys,
} from '../../test/helpers';
import { InvalidTokenError, JwtVerifier } from './jwt-verifier';

const USER_ID = '0199f0a2-1111-7000-8000-000000000001';

describe('JwtVerifier', () => {
  let keys: TestKeys;
  let verifier: JwtVerifier;

  beforeAll(async () => {
    keys = await createTestKeys();
    verifier = new JwtVerifier(testEnv(), keys.jwks);
  });

  it('chấp nhận token ES256 hợp lệ từ JWKS', async () => {
    const token = await signToken(keys, { sub: USER_ID, email: 'a@b.vn', aal: 'aal2' });
    await expect(verifier.verify(token)).resolves.toEqual({
      sub: USER_ID,
      email: 'a@b.vn',
      aal: 'aal2',
    });
  });

  it('mặc định aal1 khi thiếu claim aal', async () => {
    const token = await signToken(keys, { sub: USER_ID, aal: undefined });
    await expect(verifier.verify(token)).resolves.toMatchObject({ aal: 'aal1', email: null });
  });

  it.each([
    ['token hết hạn', { expiresIn: Math.floor(Date.now() / 1000) - 60 }],
    ['sai issuer', { issuer: 'https://evil.supabase.co/auth/v1' }],
    ['sai audience', { audience: 'service_role' }],
    ['sub không phải UUID', { sub: 'not-a-uuid' }],
  ])('từ chối %s', async (_label, overrides) => {
    const token = await signToken(keys, { sub: USER_ID, ...overrides });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('từ chối token ký bằng khóa khác', async () => {
    const otherKeys = await createTestKeys();
    const token = await signToken(otherKeys, { sub: USER_ID });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('từ chối alg none', async () => {
    const token = new UnsecuredJWT({ sub: USER_ID })
      .setIssuer('https://test-project.supabase.co/auth/v1')
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .encode();
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('từ chối HS256 khi chưa cấu hình secret', async () => {
    const token = await signHsToken(USER_ID);
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('chấp nhận HS256 khi có SUPABASE_JWT_SECRET', async () => {
    const hsVerifier = new JwtVerifier(testEnv({ SUPABASE_JWT_SECRET: TEST_HS_SECRET }), keys.jwks);
    const token = await signHsToken(USER_ID);
    await expect(hsVerifier.verify(token)).resolves.toMatchObject({ sub: USER_ID });
  });

  it('từ chối chuỗi không phải JWT', async () => {
    await expect(verifier.verify('garbage')).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
