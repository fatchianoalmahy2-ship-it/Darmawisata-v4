import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AutoUpdateHandler } from '@/components/common/AutoUpdateHandler';

export const metadata: Metadata = {
  title: 'Darmawisata',
  description: 'Darmawisata',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AutoUpdateHandler />
        {children}
      </body>
    </html>
  );
}

