import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import { APP_NAME, DESCRIPTION } from '@/lib/brand';

const display = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: `${APP_NAME}: AI-powered immigration advisor for F-1 students`,
  description:
    'Upload your I-20 and get a personalized immigration timeline, AI advisor, deadline reminders, and document vault. Built for international students.',
  keywords: 'F-1 visa, OPT, CPT, international student, immigration timeline, SEVIS, visa deadline tracker',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
  openGraph: {
    title: `${APP_NAME}: never miss an immigration deadline`,
    description: 'The AI immigration advisor that knows your actual visa situation',
    images: [{ url: '/og-image.svg', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: 'AI-powered immigration advisor for F-1 international students',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
