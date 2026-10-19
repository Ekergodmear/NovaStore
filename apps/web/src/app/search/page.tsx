import { Alert } from '@novastore/ui';
import { SiteHeader } from '../site-header';

export const metadata = { title: 'Tìm kiếm' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
        <h1 className="text-[22px] leading-7 font-semibold">
          {q ? `Kết quả cho “${q}”` : 'Tìm kiếm'}
        </h1>
        <Alert tone="info" title="Chưa có ứng dụng nào được phát hành" className="mt-6">
          Tìm kiếm full-text sẽ hoạt động khi catalog công khai ra mắt (Phase 4).
        </Alert>
      </main>
    </>
  );
}
