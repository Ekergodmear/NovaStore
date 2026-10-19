import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { loadEnv, type Env } from '../src/config/env';

export const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;
export const TEST_HS_SECRET = 'test-hs256-secret-with-at-least-32-chars!!';

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    SUPABASE_URL: TEST_SUPABASE_URL,
    REQUIRE_STAFF_MFA: 'true',
    ...overrides,
  });
}

export interface TestKeys {
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  jwks: ReturnType<typeof createLocalJWKSet>;
  kid: string;
}

export async function createTestKeys(): Promise<TestKeys> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const kid = 'test-key';
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }), kid };
}

export interface TokenOptions {
  sub: string;
  email?: string;
  aal?: 'aal1' | 'aal2';
  issuer?: string;
  audience?: string;
  expiresIn?: string | number;
}

export function signToken(keys: TestKeys, options: TokenOptions): Promise<string> {
  return new SignJWT({ email: options.email, aal: options.aal ?? 'aal1', role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: keys.kid })
    .setSubject(options.sub)
    .setIssuer(options.issuer ?? TEST_ISSUER)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m')
    .sign(keys.privateKey);
}

export function signHsToken(sub: string, secret = TEST_HS_SECRET): Promise<string> {
  return new SignJWT({ aal: 'aal1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(TEST_ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
}
