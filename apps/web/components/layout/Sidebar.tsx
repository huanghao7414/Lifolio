'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAPIClient } from '@/lib/api';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', label: '首页', icon: '⌂' },
  { href: '/items',     label: '物品', icon: '◻' },
  { href: '/insights',  label: '价值', icon: '✦' },
  { href: '/settings',  label: '设置', icon: '⚙' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    getAPIClient().getIdentity().then(identity => { if (active) setIsAdmin(identity.is_admin); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <aside className="w-[248px] flex flex-col border-r border-line bg-surface shrink-0">
      <div className="px-5 py-6">
        <span className="font-bold text-h3 tracking-tight">Lifolio</span>
        <p className="text-caption text-ink-2 mt-0.5">量化人生簿</p>
      </div>

      <nav className="flex-1 px-3 space-y-1" aria-label="主导航">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? 'page' : undefined}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-body font-medium min-h-touch transition-colors duration-fast ease-swift',
              pathname.startsWith(href)
                ? 'bg-accent-soft text-accent-text font-semibold'
                : 'text-ink-2 hover:bg-canvas hover:text-ink-1',
            )}
          >
            <span className="text-base" aria-hidden="true">{icon}</span>
            {label}
          </Link>
        ))}
        {isAdmin && <Link href="/admin" className="flex items-center gap-3 px-3 py-3 text-sm text-ink-2 hover:bg-canvas rounded-md">▤ 服务管理后台</Link>}
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
