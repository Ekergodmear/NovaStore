import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { beVietnam } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'NovaStore Developer Console', template: '%s · NovaStore Developer Console' },
  description: 'Đăng và quản lý ứng dụng Android trên NovaStore.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body>{children}</body>
    </html>
  );
}
