'use client';
import { clsx } from './clsx';

export function Button(
  { children, variant = 'primary', className, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'accent' | 'ghost' | 'danger' },
) {
  const base = 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-ink text-white hover:bg-ink-700',
    accent: 'bg-beacon text-ink hover:bg-beacon-600 font-semibold',
    ghost: 'border border-slate-300 text-ink hover:bg-slate-100',
    danger: 'text-red-600 hover:bg-red-50',
  };
  return <button className={clsx(base, variants[variant], className)} {...props}>{children}</button>;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)}>{children}</div>;
}

export function Disclaimer() {
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
      Informational only — not legal advice. Always confirm immigration questions with your DSO.
    </p>
  );
}
