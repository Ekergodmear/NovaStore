import { cva, type VariantProps } from 'class-variance-authority';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from 'react';
import { cn } from './cn';

const buttonCva = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:opacity-90',
        secondary: 'bg-surface-muted text-fg hover:bg-border',
        ghost: 'text-fg hover:bg-surface-muted',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-5 text-[15px]',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

/** Class của Button cho thẻ khác (vd. Link). `className` được gộp bằng tailwind-merge. */
export function buttonVariants({
  className,
  ...variants
}: VariantProps<typeof buttonCva> & { className?: string } = {}): string {
  return cn(buttonCva(variants), className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonCva>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg bg-surface p-6 shadow-[var(--shadow-card)]', className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-border bg-surface px-4 text-[15px] text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-fg', className)} {...props} />;
}

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium',
  {
    variants: {
      tone: {
        primary: 'bg-primary-soft text-primary',
        muted: 'bg-surface-muted text-fg-muted',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-danger/15 text-danger',
        info: 'bg-info/15 text-info',
      },
    },
    defaultVariants: { tone: 'muted' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger';
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-info/30 bg-info/10',
    warning: 'border-warning/30 bg-warning/10',
    danger: 'border-danger/30 bg-danger/10',
  };
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-md border p-4', tones[tone], className)}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-fg-muted">{children}</div> : null}
    </div>
  );
}

export function Logo({ suffix, className }: { suffix?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-[22%] bg-primary text-primary-fg text-sm font-bold"
      >
        N
      </span>
      <span className="text-lg">NovaStore</span>
      {suffix ? <span className="text-lg font-normal text-fg-muted">{suffix}</span> : null}
    </span>
  );
}

/** Bố cục console: sidebar trái (ẩn trên mobile thành thanh trên cùng) + nội dung. */
export function ConsoleShell({
  brand,
  nav,
  actions,
  children,
}: {
  brand: ReactNode;
  nav: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className="border-b border-border bg-surface px-4 py-4 md:min-h-dvh md:border-r md:border-b-0 md:py-6">
        <div className="px-2">{brand}</div>
        <nav className="mt-4 flex gap-1 overflow-x-auto md:mt-8 md:flex-col">{nav}</nav>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-end gap-3 px-4 md:px-8">{actions}</header>
        <main className="px-4 pb-12 md:px-8">{children}</main>
      </div>
    </div>
  );
}

export function NavItem({
  active,
  disabled,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { active?: boolean; disabled?: boolean }) {
  return (
    <span
      aria-disabled={disabled || undefined}
      className={cn(
        'block rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap',
        active ? 'bg-primary-soft text-primary' : 'text-fg hover:bg-surface-muted',
        disabled && 'pointer-events-none text-fg-muted opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-fg-muted">{label}</p>
      <p className="mt-2 text-[32px] leading-10 font-bold">{value}</p>
      {hint ? <p className="mt-1 text-[13px] text-fg-muted">{hint}</p> : null}
    </Card>
  );
}
