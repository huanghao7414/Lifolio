import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lifolio · 量化人生簿',
  description: 'AI-powered personal life asset management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-white text-[#1D1D1F] antialiased">{children}</body>
    </html>
  );
}
