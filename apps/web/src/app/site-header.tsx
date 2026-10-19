import { buttonVariants, Logo } from '@novastore/ui';
import { SignOutButton } from '@novastore/web-auth/client';
import { fetchMe } from '@novastore/web-auth/server';
import Link from 'next/link';

const DEVELOPER_CONSOLE_URL = process.env.NEXT_PUBLIC_DEVELOPER_URL ?? 'http://localhost:3001';

export async function SiteHeader() {
  const me = await fetchMe();

  return (
    <header className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 md:px-6">
      <Link href="/" aria-label="Trang chủ NovaStore">
        <Logo />
      </Link>
      <form action="/search" className="ml-auto hidden flex-1 md:block md:max-w-md">
        <label htmlFor="q" className="sr-only">
          Tìm kiếm ứng dụng
        </label>
        <input
          id="q"
          name="q"
          type="search"
          placeholder="Tìm ứng dụng, nhà phát triển…"
          className="h-11 w-full rounded-full bg-surface-muted px-5 text-[15px] placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </form>
      <nav className="ml-auto flex items-center gap-2 md:ml-0">
        <a
          href={DEVELOPER_CONSOLE_URL}
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'hidden sm:inline-flex',
          })}
        >
          Dành cho nhà phát triển
        </a>
        {me.kind === 'ok' ? (
          <>
            <span className="hidden text-sm text-fg-muted lg:inline">
              {me.data.displayName ?? me.data.email}
            </span>
            <SignOutButton />
          </>
        ) : (
          <Link href="/login" className={buttonVariants({ size: 'sm' })}>
            Đăng nhập
          </Link>
        )}
      </nav>
    </header>
  );
}
