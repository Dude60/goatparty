import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'goatparty - Peer-to-Peer Watch Party',
  description: 'Sync local movie playback with friends over WebRTC with zero server video upload.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐐</text></svg>',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#121314] text-zinc-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
