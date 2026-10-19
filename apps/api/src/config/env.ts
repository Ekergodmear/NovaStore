import { z } from '@novastore/validation';

const DEV_IP_HASH_SECRET = 'dev-only-ip-hash-secret-change-me-0000';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_JWT_SECRET: z.string().min(32).optional(),
    JWT_AUDIENCE: z.string().min(1).default('authenticated'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:3001,http://localhost:3002')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    REQUIRE_STAFF_MFA: booleanString.optional(),
    IP_HASH_SECRET: z.string().min(32).default(DEV_IP_HASH_SECRET),
    TRUST_PROXY: booleanString.default(false),
    SENTRY_DSN: z.url().optional(),
  })
  .refine((env) => env.SUPABASE_URL || env.SUPABASE_JWT_SECRET, {
    message: 'Cần SUPABASE_URL (xác minh JWKS) hoặc SUPABASE_JWT_SECRET (HS256)',
    path: ['SUPABASE_URL'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.IP_HASH_SECRET !== DEV_IP_HASH_SECRET, {
    message: 'IP_HASH_SECRET phải được đặt ở production',
    path: ['IP_HASH_SECRET'],
  })
  .transform((env) => ({
    ...env,
    REQUIRE_STAFF_MFA: env.REQUIRE_STAFF_MFA ?? env.NODE_ENV === 'production',
  }));

export type Env = z.output<typeof envSchema>;

/** Đọc và kiểm tra biến môi trường; chuỗi rỗng được coi là không đặt. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
