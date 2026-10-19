import { ConsoleShell, Logo } from '@novastore/ui';
import { SignOutButton } from '@novastore/web-auth/client';
import { ApiResultNotice } from '@novastore/web-auth/notice';
import { fetchMe } from '@novastore/web-auth/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConsoleNav } from './console-nav';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const me = await fetchMe();

  if (me.kind === 'anonymous') redirect('/login');
  if (me.kind !== 'ok') {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <ApiResultNotice result={me} />
      </main>
    );
  }

  return (
    <ConsoleShell
      brand={<Logo suffix="Developer" />}
      nav={<ConsoleNav />}
      actions={
        <>
          <span className="text-sm text-fg-muted">{me.data.displayName ?? me.data.email}</span>
          <SignOutButton />
        </>
      }
    >
      {children}
    </ConsoleShell>
  );
}
