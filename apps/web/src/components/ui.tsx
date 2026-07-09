'use client';
import { clsx } from './clsx';

export function Button(
  { children, variant = 'primary', className, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'accent' | 'ghost' | 'danger' },
) {
  const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-ink text-white hover:bg-ink-700 shadow-sm',
    accent: 'bg-beacon text-ink hover:bg-beacon-600 font-semibold shadow-sm',
    ghost: 'border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
    danger: 'text-red-600 hover:bg-red-50 border border-red-200',
  };
  return <button className={clsx(base, variants[variant], className)} {...props}>{children}</button>;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ink focus:ring-2 focus:ring-ink/10',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-700">{children}</label>;
}

export function Card({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div style={style} className={clsx('rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-slate-200', className)} />;
}

export function Disclaimer() {
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
      Informational only, not legal advice. Always confirm immigration questions with your DSO.
    </p>
  );
}
