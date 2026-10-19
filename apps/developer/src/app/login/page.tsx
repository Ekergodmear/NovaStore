import { LoginForm } from '@novastore/web-auth/client';
import { Logo } from '@novastore/ui';
import Link from 'next/link';

export const metadata = { title: 'Đăng nhập' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Link href="/">
          <Logo suffix="Developer" />
        </Link>
        <LoginForm heading="Đăng nhập Developer Console" next={next ?? '/'} />
      </div>
    </main>
  );
}
