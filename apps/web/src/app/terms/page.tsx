import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export const metadata = { title: `Terms of Service — ${APP_NAME}` };

export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-ink">← Back</Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {new Date().getFullYear()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Not legal advice</h2>
          <p className="mt-2"><strong>{APP_NAME}</strong> provides informational tools only. Timelines,
          deadlines, and reminders are generated from general rules and may not fit your specific case.
          Nothing here is legal or immigration advice. Always confirm with your Designated School
          Official (DSO) or a qualified attorney before making decisions.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Your responsibility</h2>
          <p className="mt-2">You are responsible for verifying all dates and for meeting your own
          immigration obligations. {APP_NAME} is a helper, not a guarantor. We are not liable for missed
          deadlines or actions taken based on the information shown.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Your account</h2>
          <p className="mt-2">Keep your login secure and provide accurate information. You may stop using
          the service and delete your account at any time.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Changes</h2>
          <p className="mt-2">We may update these terms as the product evolves. Continued use means you
          accept the current version.</p>
        </div>

        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          This is a starting template, not reviewed legal text. Have a lawyer review it before public launch.
        </p>
      </div>
    </main>
  );
}
