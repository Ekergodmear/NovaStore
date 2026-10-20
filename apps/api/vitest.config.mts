import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC cần thiết để giữ decorator metadata cho DI của NestJS (esbuild không hỗ trợ).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts', 'test/**/*.int-spec.ts'],
    // Integration test khởi động Postgres (PGlite) + app NestJS đầy đủ.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
