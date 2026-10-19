// Origin giả chỉ dùng để phân giải URL; không bao giờ trả ra ngoài.
const PROBE_ORIGIN = 'https://novastore.invalid';

/**
 * Chuẩn hóa tham số `?next=` sau đăng nhập thành đường dẫn nội bộ, chống open redirect.
 * Trình duyệt coi `\` như `/` và bỏ tab/xuống dòng, nên `/\evil.com` hay `/\t/evil.com`
 * trỏ ra ngoài dù bắt đầu bằng `/`. Vì vậy phân giải bằng URL thật rồi so origin.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.includes('\\')) return '/';

  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return '/';
  }
  if (url.origin !== PROBE_ORIGIN) return '/';

  return `${url.pathname}${url.search}${url.hash}`;
}
