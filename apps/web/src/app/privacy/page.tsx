import { APP_NAME } from '@/lib/brand';
import { BackButton } from '@/components/back-button';

export const metadata = { title: `Privacy Policy: ${APP_NAME}` };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <BackButton />
      <h1 className="mt-4 font-display text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {new Date().getFullYear()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <p><strong>{APP_NAME}</strong> is built for international students and handles sensitive
        information, including immigration documents. We take that seriously. This policy explains
        what we collect, why, and your choices.</p>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">What we collect</h2>
          <p className="mt-2">Account details (name, email), the profile information you enter
          (university, program dates, visa type), documents you choose to upload (such as your I-20),
          and job applications you track. Sensitive identifiers like your SEVIS ID are encrypted.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">How we use it</h2>
          <p className="mt-2">To compute your immigration timeline, send you deadline reminders,
          store your documents, and provide the application tracker. We do not sell your data. We do
          not use your documents for advertising.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Document storage</h2>
          <p className="mt-2">Uploaded documents are stored privately and are only accessible to you.
          Files are never made public. You can delete any document, and deleting your account removes
          your data.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Your choices</h2>
          <p className="mt-2">You can view, correct, export, or delete your data at any time from your
          account settings. Deleting your account revokes your sessions and schedules removal of your
          stored files.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-2">Questions about privacy? Reach us at privacy@{APP_NAME.toLowerCase()}.app.</p>
        </div>

        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          This is a starting template, not reviewed legal text. Have a lawyer review it before public launch.
        </p>
      </div>
    </main>
  );
}
