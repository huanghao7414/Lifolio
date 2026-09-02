import type { Metadata } from 'next';
import '@lifolio/tokens/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lifolio · 量化人生簿',
  description: 'AI-powered personal life asset management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-canvas text-ink-1 antialiased">{children}</body>
    </html>
  );
}
