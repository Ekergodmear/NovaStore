'use client';

import { NavItem } from '@novastore/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Sidebar theo docs/UI_DESIGN_SYSTEM.md §4.3. Mục chưa có sẽ mở dần từ Phase 2.
const ITEMS = [
  { href: '/', label: 'Tổng quan', ready: true },
  { href: '/apps', label: 'Ứng dụng của tôi', ready: false },
  { href: '/apps/new', label: 'Tạo ứng dụng', ready: false },
  { href: '/releases', label: 'Phiên bản', ready: false },
  { href: '/reviews', label: 'Đánh giá', ready: false },
  { href: '/stats', label: 'Thống kê', ready: false },
  { href: '/account', label: 'Tài khoản', ready: true },
];

export function ConsoleNav() {
  const pathname = usePathname();
  return ITEMS.map((item) =>
    item.ready ? (
      <Link key={item.href} href={item.href}>
        <NavItem active={pathname === item.href}>{item.label}</NavItem>
      </Link>
    ) : (
      <NavItem key={item.href} disabled title="Sắp ra mắt">
        {item.label}
      </NavItem>
    ),
  );
}
