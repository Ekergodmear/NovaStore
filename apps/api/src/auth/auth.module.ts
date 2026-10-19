import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JWKS_RESOLVER } from '../config/tokens';
import { IdentityModule } from '../identity/identity.module';
import { AuthGuard } from './auth.guard';
import { JwtVerifier } from './jwt-verifier';
import { RolesGuard } from './roles.guard';

/** Thứ tự guard toàn cục: rate limit → xác thực → phân quyền. */
@Module({
  imports: [IdentityModule],
  providers: [
    // null = tự tạo JWKS từ SUPABASE_URL. Test override bằng JWKS cục bộ.
    { provide: JWKS_RESOLVER, useValue: null },
    JwtVerifier,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtVerifier],
})
export class AuthModule {}
