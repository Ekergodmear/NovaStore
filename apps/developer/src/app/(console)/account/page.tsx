import { Badge, Card } from '@novastore/ui';
import { fetchMe } from '@novastore/web-auth/server';
import type { ReactNode } from 'react';

export const metadata = { title: 'Tài khoản' };

export default async function AccountPage() {
  const me = await fetchMe();
  if (me.kind !== 'ok') return null;
  const { data } = me;

  const rows: Array<[string, ReactNode]> = [
    ['Email', data.email ?? '—'],
    ['Tên hiển thị', data.displayName ?? '—'],
    ['User ID', <span className="font-mono text-[13px]">{data.id}</span>],
    [
      'Vai trò',
      <span className="flex flex-wrap gap-1.5">
        {data.roles.map((role) => (
          <Badge key={role} tone={role === 'user' ? 'muted' : 'primary'}>
            {role}
          </Badge>
        ))}
      </span>,
    ],
    [
      'MFA',
      data.mfa.level === 'aal2' ? (
        <Badge tone="primary">Đã xác thực 2 lớp</Badge>
      ) : (
        <Badge>Chưa bật</Badge>
      ),
    ],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[32px] leading-10 font-bold">Tài khoản</h1>
      <Card className="max-w-2xl">
        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[140px_1fr] gap-4 py-3 text-[15px]">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="min-w-0 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
