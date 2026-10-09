import type { Metadata, Viewport } from 'next';
// Self-hosted fonts (unicode-range subsets: only Tamil/Latin files a page needs are fetched).
import '@fontsource/mukta-malar/400.css';
import '@fontsource/mukta-malar/600.css';
import '@fontsource/mukta-malar/700.css';
import '@fontsource/noto-serif-tamil/600.css';
import '@fontsource/noto-serif-tamil/700.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ஸ்ரீ கொன்னை அம்மன் ஆலயம் · Navaratri Ubayam',
  description: 'ஸ்ரீ கொன்னை அம்மன் ஆலயம், கார்காத்தி — நவராத்திரி உபயம் பதிவு. Sri Konnai Amman Temple, Karkathi — Navaratri Ubayam booking.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#6B0F1A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ta">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
