import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { beVietnam } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'NovaStore — Kho ứng dụng Android', template: '%s · NovaStore' },
  description: 'Khám phá và tải ứng dụng Android đã được kiểm duyệt an toàn.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body>{children}</body>
    </html>
  );
}
