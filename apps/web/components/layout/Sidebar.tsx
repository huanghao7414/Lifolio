'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', label: '首页', icon: '⌂' },
  { href: '/items',     label: '物品', icon: '◻' },
  { href: '/insights',  label: '价值', icon: '✦' },
  { href: '/settings',  label: '设置', icon: '⚙' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [aiOpen, setAiOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="w-56 flex flex-col border-r border-gray-100 bg-white shrink-0">
      <div className="px-5 py-6">
        <span className="font-bold text-lg tracking-tight">Lifolio</span>
        <p className="text-xs text-gray-400 mt-0.5">量化人生簿</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-brand text-white'
                : 'text-gray-600 hover:bg-surface',
            )}
          >
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* AI FAB */}
      <div className="p-4">
        <button
          onClick={() => {
            // Dispatch a custom event that AIChatPanel listens to
            window.dispatchEvent(new CustomEvent('lifolio:open-ai'));
          }}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <span>✦</span> AI 助手
        </button>
      </div>
    </aside>
  );
}
