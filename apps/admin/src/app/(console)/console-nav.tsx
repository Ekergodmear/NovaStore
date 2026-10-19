'use client';

import { NavItem } from '@novastore/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Dashboard', ready: true },
  { href: '/queue', label: 'Hàng đợi kiểm duyệt', ready: false },
  { href: '/reports', label: 'Báo cáo vi phạm', ready: false },
  { href: '/apps', label: 'Ứng dụng', ready: false },
  { href: '/developers', label: 'Nhà phát triển', ready: false },
  { href: '/audit-logs', label: 'Audit log', ready: false },
];

export function ConsoleNav() {
  const pathname = usePathname();
  return ITEMS.map((item) =>
    item.ready ? (
      <Link key={item.href} href={item.href}>
        <NavItem active={pathname === item.href}>{item.label}</NavItem>
      </Link>
    ) : (
      <NavItem key={item.href} disabled title="Sắp ra mắt (Phase 3)">
        {item.label}
      </NavItem>
    ),
  );
}
