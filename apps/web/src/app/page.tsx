import { Badge, Card } from '@novastore/ui';
import { SiteHeader } from './site-header';

// Khớp với seed trong packages/database/prisma/seed.ts. Phase 4 sẽ đọc từ GET /api/v1/categories.
const CATEGORIES = [
  'Năng suất',
  'Giáo dục',
  'Công cụ',
  'Liên lạc',
  'Giải trí',
  'Trò chơi',
  'Tài chính',
  'Sức khỏe & Thể hình',
  'Nhiếp ảnh',
  'Du lịch',
  'Mua sắm',
  'Phong cách sống',
];

const TRUST_POINTS = [
  {
    title: 'Kiểm duyệt trước khi phát hành',
    body: 'Mỗi APK được kiểm tra cấu trúc, chữ ký và quét bảo mật, sau đó được kiểm duyệt viên xem xét.',
  },
  {
    title: 'Minh bạch quyền truy cập',
    body: 'Xem rõ ứng dụng xin quyền gì, chứng chỉ ký và mã SHA-256 trước khi cài.',
  },
  {
    title: 'Cập nhật an toàn',
    body: 'Bản cập nhật phải cùng package name và chữ ký với bản bạn đang dùng.',
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 pb-16 md:px-6">
        <section className="mt-6 rounded-xl bg-primary-soft px-6 py-12 md:px-12 md:py-16">
          <Badge tone="primary" className="bg-surface">
            Beta sắp ra mắt
          </Badge>
          <h1 className="mt-4 max-w-2xl text-[32px] leading-10 font-bold md:text-[40px] md:leading-[48px]">
            Kho ứng dụng Android độc lập, được kiểm duyệt cẩn thận.
          </h1>
          <p className="mt-4 max-w-xl text-fg-muted">
            Khám phá ứng dụng từ các nhà phát triển độc lập. Mọi phiên bản đều qua kiểm tra bảo mật
            và kiểm duyệt thủ công trước khi đến tay bạn.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="text-[22px] leading-7 font-semibold">
            Danh mục
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((name) => (
              <li key={name}>
                <span className="block rounded-md bg-surface px-4 py-3 text-[15px] font-medium shadow-[var(--shadow-card)]">
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="Cam kết an toàn">
          {TRUST_POINTS.map((point) => (
            <Card key={point.title}>
              <h3 className="text-lg font-semibold">{point.title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{point.body}</p>
            </Card>
          ))}
        </section>
      </main>
    </>
  );
}
