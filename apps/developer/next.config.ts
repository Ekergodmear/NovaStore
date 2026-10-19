import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@novastore/ui', '@novastore/web-auth'],
  // Lint chạy riêng qua `pnpm lint` với cấu hình ESLint gốc của monorepo.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
