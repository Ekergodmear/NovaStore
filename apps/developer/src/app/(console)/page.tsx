import { Badge, Button, Card, KpiCard } from '@novastore/ui';
import { fetchMe } from '@novastore/web-auth/server';

export const metadata = { title: 'Tổng quan' };

export default async function OverviewPage() {
  const me = await fetchMe();
  if (me.kind !== 'ok') return null; // layout đã xử lý các trạng thái khác

  const accounts = me.data.developerAccounts;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] leading-10 font-bold">Tổng quan</h1>
        <p className="mt-1 text-fg-muted">
          Xin chào {me.data.displayName ?? me.data.email}. Đây là nơi bạn quản lý ứng dụng trên
          NovaStore.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold">Tạo tài khoản nhà phát triển</h2>
          <p className="mt-2 text-sm text-fg-muted">
            Bạn cần một developer account (tên hiển thị, email liên hệ, đồng ý Developer Agreement)
            trước khi đăng ứng dụng đầu tiên.
          </p>
          <Button className="mt-4" disabled>
            Tạo developer account
          </Button>
          <p className="mt-2 text-[13px] text-fg-muted">Sẽ mở ở Phase 2.</p>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold">Tài khoản nhà phát triển</h2>
          <ul className="mt-3 space-y-2">
            {accounts.map((account) => (
              <li key={account.developerAccountId} className="flex items-center gap-3">
                <span className="font-medium">{account.displayName}</span>
                <span className="font-mono text-[13px] text-fg-muted">/{account.slug}</span>
                <Badge tone="primary">{account.memberRole}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Chỉ số">
        <KpiCard label="Ứng dụng" value="0" />
        <KpiCard label="Phiên bản chờ duyệt" value="0" />
        <KpiCard label="Lượt tải 30 ngày" value="0" />
      </section>
    </div>
  );
}
