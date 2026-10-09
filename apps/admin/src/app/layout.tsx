import type { Metadata } from 'next';
import '@fontsource/mukta-malar/400.css';
import '@fontsource/mukta-malar/600.css';
import '@fontsource/mukta-malar/700.css';
import '@fontsource/noto-serif-tamil/700.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Temple Admin · Navaratri Ubayam',
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
