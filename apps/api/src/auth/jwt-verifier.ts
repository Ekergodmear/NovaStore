import { Inject, Injectable } from '@nestjs/common';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import type { Env } from '../config/env';
import { ENV, JWKS_RESOLVER } from '../config/tokens';

export interface AccessTokenClaims {
  sub: string;
  email: string | null;
  aal: 'aal1' | 'aal2';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASYMMETRIC_ALGS = ['ES256', 'RS256', 'EdDSA'];

export class InvalidTokenError extends Error {}

/**
 * Xác minh access token do Supabase Auth phát hành.
 * - Khóa bất đối xứng (mặc định cho project mới): JWKS tại {SUPABASE_URL}/auth/v1/.well-known/jwks.json
 * - Legacy HS256: SUPABASE_JWT_SECRET
 */
@Injectable()
export class JwtVerifier {
  private readonly issuer?: string;
  private readonly audience: string;
  private readonly jwks?: JWTVerifyGetKey;
  private readonly secret?: Uint8Array;

  constructor(@Inject(ENV) env: Env, @Inject(JWKS_RESOLVER) jwks: JWTVerifyGetKey | null) {
    this.issuer = env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1` : undefined;
    this.audience = env.JWT_AUDIENCE;
    this.jwks =
      jwks ??
      (this.issuer
        ? createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`))
        : undefined);
    this.secret = env.SUPABASE_JWT_SECRET
      ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
      : undefined;
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    let payload: JWTPayload;
    try {
      const { alg } = decodeProtectedHeader(token);
      const options = { issuer: this.issuer, audience: this.audience, clockTolerance: 5 };

      if (alg === 'HS256') {
        if (!this.secret) throw new InvalidTokenError('HS256 not configured');
        ({ payload } = await jwtVerify(token, this.secret, { ...options, algorithms: ['HS256'] }));
      } else {
        if (!this.jwks) throw new InvalidTokenError('JWKS not configured');
        ({ payload } = await jwtVerify(token, this.jwks, {
          ...options,
          algorithms: ASYMMETRIC_ALGS,
        }));
      }
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError(error instanceof Error ? error.message : 'Invalid token');
    }

    if (typeof payload.sub !== 'string' || !UUID_RE.test(payload.sub)) {
      throw new InvalidTokenError('Missing or invalid sub');
    }
    if (payload.exp === undefined) {
      throw new InvalidTokenError('Missing exp');
    }

    return {
      sub: payload.sub.toLowerCase(),
      email: typeof payload.email === 'string' && payload.email ? payload.email : null,
      aal: payload.aal === 'aal2' ? 'aal2' : 'aal1',
    };
  }
}
