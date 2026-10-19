import type { AdminDashboardResponse } from '@novastore/types';
import { KpiCard } from '@novastore/ui';
import { ApiResultNotice } from '@novastore/web-auth/notice';
import { apiGet } from '@novastore/web-auth/server';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const result = await apiGet<AdminDashboardResponse>('/admin/dashboard');

  return (
    <div className="space-y-6">
      <h1 className="text-[32px] leading-10 font-bold">Dashboard</h1>
      {result.kind !== 'ok' ? (
        <ApiResultNotice result={result} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="KPI">
          <KpiCard label="Chờ kiểm duyệt" value={result.data.pendingReview} />
          <KpiCard label="Phiên bản gửi trong 24h" value={result.data.submittedLast24h} />
          <KpiCard label="Báo cáo đang mở" value={result.data.openReports} />
          <KpiCard
            label="Developer hoạt động"
            value={result.data.activeDevelopers}
            hint="Có cập nhật ứng dụng trong 30 ngày"
          />
          <KpiCard
            label="Tỷ lệ phê duyệt"
            value={
              result.data.approvalRate30d === null
                ? '—'
                : `${Math.round(result.data.approvalRate30d * 100)}%`
            }
            hint="30 ngày gần nhất"
          />
        </section>
      )}
    </div>
  );
}
