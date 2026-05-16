import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'You Design — Local-first AI design + code workspace',
    template: '%s · You Design',
  },
  description:
    'Questions the brief, criticizes honestly, navigates across resolutions — with a multi-agent expert team. Locally.',
  applicationName: 'You Design',
  keywords: [
    'AI design',
    'design tool',
    'open source',
    'self-host',
    'figma alternative',
    'V0 alternative',
    'multi-agent',
  ],
  authors: [{ name: 'sabahattink' }],
  openGraph: {
    title: 'You Design',
    description: 'Local-first AI design + code workspace',
    url: 'https://youdesign.dev',
    siteName: 'You Design',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
