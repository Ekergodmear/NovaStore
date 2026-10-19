import { STAFF_ROLES } from '@novastore/types';
import { Alert, ConsoleShell, Logo } from '@novastore/ui';
import { SignOutButton } from '@novastore/web-auth/client';
import { ApiResultNotice } from '@novastore/web-auth/notice';
import { fetchMe } from '@novastore/web-auth/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConsoleNav } from './console-nav';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await fetchMe();

  if (me.kind === 'anonymous') redirect('/login');
  if (me.kind !== 'ok') {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <ApiResultNotice result={me} />
      </main>
    );
  }

  // UI chỉ ẩn/hiện; API mới là nơi thực thi phân quyền (RolesGuard).
  const isStaff = me.data.roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
  if (!isStaff) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
        <Logo suffix="Admin" />
        <Alert tone="danger" title="403 — Không có quyền truy cập">
          Tài khoản {me.data.email} không có vai trò Moderator hoặc Admin. Liên hệ quản trị viên nếu
          bạn cho rằng đây là nhầm lẫn.
        </Alert>
        <div>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <ConsoleShell
      brand={<Logo suffix="Admin" />}
      nav={<ConsoleNav />}
      actions={
        <>
          <span className="text-sm text-fg-muted">
            {me.data.email} · {me.data.roles.filter((r) => r !== 'user').join(', ')}
          </span>
          <SignOutButton />
        </>
      }
    >
      {children}
    </ConsoleShell>
  );
}
