import Link from 'next/link';

export function SecurityBadge({ variant = 'inline' }: { variant?: 'inline' | 'card' | 'banner' }) {
  if (variant === 'banner') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl text-emerald-600">🔒</span>
          <div>
            <p className="font-medium text-emerald-800">Your documents are secure</p>
            <p className="mt-1 text-sm text-emerald-700">
              Your document is encrypted immediately on upload. Only you can access it. We use it only to
              extract dates and generate your personal alerts. Never shared with anyone, delete anytime.
            </p>
            <Link href="/security" className="mt-1 inline-block text-sm font-medium text-emerald-800 underline">
              Read our security policy →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
        <span className="text-emerald-600">🔒</span>
        <span className="text-xs font-medium text-emerald-700">
          AES-256 encrypted, private, never shared, delete anytime
        </span>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-1 text-xs text-emerald-600">
      <span>🔒</span>
      <span>Encrypted and private, only you can access this</span>
    </p>
  );
}
