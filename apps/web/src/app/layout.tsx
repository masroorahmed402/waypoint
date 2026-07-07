import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import { APP_NAME, DESCRIPTION } from '@/lib/brand';

const display = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: `${APP_NAME} — never miss an immigration deadline`,
  description: DESCRIPTION,
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Waypoint — never miss an immigration deadline',
    description: DESCRIPTION,
    images: [{ url: '/og-image.svg', width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
