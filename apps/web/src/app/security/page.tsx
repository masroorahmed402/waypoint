import { APP_NAME } from '@/lib/brand';
import { BackButton } from '@/components/back-button';

export const metadata = { title: `Security: ${APP_NAME}` };

export default function Security() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <BackButton />
      <h1 className="mt-4 font-display text-3xl font-semibold">Security</h1>
      <p className="mt-2 text-sm text-slate-500">How we protect your data, in plain English.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">What we encrypt</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your SEVIS ID (AES-256-GCM, application layer)</li>
            <li>Your passport number (AES-256-GCM, application layer)</li>
            <li>Your date of birth (AES-256-GCM, application layer)</li>
            <li>All documents at rest (server-side encryption on our storage provider)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">What we never do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Sell your data</li>
            <li>Use your documents for advertising</li>
            <li>Share your documents with third parties</li>
            <li>Train AI models on your data</li>
            <li>Retain your data after you delete it</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">What happens to your documents</h2>
          <p className="mt-2">
            Uploaded files go straight to a private Cloudflare R2 bucket. They are never publicly
            accessible. Download links are presigned URLs that expire after 2 minutes. When you delete
            a document, the underlying file is removed from storage.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Third parties</h2>
          <p className="mt-2">We use a small, named set of vendors, and only for what's listed:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Cloudflare R2</strong>, file storage</li>
            <li><strong>Resend</strong>, email delivery</li>
            <li><strong>Railway</strong>, application hosting</li>
            <li><strong>Groq</strong>, AI advisor responses (text only, your documents are never sent)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Delete your data</h2>
          <p className="mt-2">
            Go to Settings, scroll to Danger zone, and confirm account deletion. This permanently
            removes your profile, documents, and encrypted fields from our servers.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-2">Security questions or reports: security@{APP_NAME.toLowerCase().replace(/\s+/g, '')}.app</p>
        </div>
      </div>
    </main>
  );
}
