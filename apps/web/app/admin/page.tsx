'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AdminOverview } from '@lifolio/shared-types';
import { APIError } from '@lifolio/api-client';
import { getAPIClient } from '@/lib/api';

const STATUS: Record<string, string> = { ok: '正常', degraded: '部分异常', configured: '已配置', not_configured: '未配置' };
const COUNTS = [
  ['users', '注册用户'], ['new_users_7d', '近 7 天新用户'], ['transactions', '账单记录'],
  ['items', '物品'], ['conversations', 'AI 会话'], ['messages', '会话消息'], ['ai_configs', '自有模型配置'],
] as const;
const number = (value: number | null) => value === null ? '未知' : value.toLocaleString('zh-CN');

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError('');
    try {
      const result = await getAPIClient().getAdminOverview();
      if (active.current) { setData(result); setDenied(false); }
    } catch (err) {
      if (!active.current) return;
      const accessDenied = err instanceof APIError && (err.status === 401 || err.status === 403);
      if (accessDenied) setData(null);
      setDenied(accessDenied);
      setError(err instanceof Error ? err.message : '无法读取服务状态，请稍后重试');
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }, []);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; }; }, [load]);

  return <main className="min-h-screen bg-canvas p-5 sm:p-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div><Link href="/dashboard" className="text-sm font-semibold text-accent-text">← Lifolio 应用</Link>
          <h1 className="text-3xl font-bold mt-3">服务管理后台</h1><p className="text-sm text-ink-2 mt-2">应用运行状态与使用概览</p></div>
        <button onClick={load} disabled={loading} className="btn-primary">{loading ? '检查中…' : '刷新状态'}</button>
      </header>
      {error && <div role="alert" className="card border border-red-200 text-red-700">{error}{denied && <p className="mt-2 text-sm">请使用部署时指定的管理员账号登录。</p>}</div>}
      {loading && !data && <p role="status" className="text-ink-2">正在验证管理权限并读取服务状态…</p>}
      {data && <>
        <div className="flex flex-wrap gap-3 items-center text-sm"><span className={`rounded-full px-3 py-1 ${data.status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{STATUS[data.status]}</span>
          <span className="text-ink-2">最近检查：{new Date(data.checked_at).toLocaleString('zh-CN')} · v{data.version}</span>
          {error && <span className="text-orange-700">以下为上次成功读取的数据</span>}</div>
        <section aria-label="服务状态" className="grid gap-4 md:grid-cols-3">{data.services.map(service => <div className="card" key={service.name}>
          <div className="flex justify-between"><h2 className="font-semibold">{service.name}</h2><span className={`text-xs ${service.status === 'ok' ? 'text-green-700' : 'text-ink-2'}`}>{STATUS[service.status] ?? service.status}</span></div>
          <p className="text-sm text-ink-2 mt-3">{service.detail}</p></div>)}</section>
        <section aria-label="应用数据量" className="grid grid-cols-2 lg:grid-cols-4 gap-4">{COUNTS.map(([key, label]) => <div className="card" key={key}>
          <p className="text-sm text-ink-2">{label}</p><p className="text-3xl font-semibold tnum mt-2">{number(data.totals[key])}</p></div>)}</section>
        <section className="card space-y-4"><div><h2 className="font-semibold">请求与性能</h2>
          <p className="text-xs text-ink-2 mt-1">仅当前服务进程，自 {new Date(data.metrics.started_at).toLocaleString('zh-CN')} 起累计；重启后清零。P95 取最近 {data.metrics.latency_sample_count} 次完成的请求，包含流式回复耗时。</p></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['请求总数', number(data.metrics.requests)], ['服务错误率', `${(data.metrics.server_errors / Math.max(data.metrics.requests, 1) * 100).toFixed(1)}%`], ['平均耗时', `${data.metrics.average_latency_ms} ms`], ['P95 耗时', `${data.metrics.p95_latency_ms} ms`]].map(([label, value]) => <div key={label}><p className="text-xs text-ink-2">{label}</p><p className="text-xl font-semibold tnum mt-1">{value}</p></div>)}
          </div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-ink-2"><th className="py-3 font-medium">接口</th><th>请求次数</th><th>服务错误（5xx）</th></tr></thead><tbody>
            {data.metrics.routes.map(route => <tr className="border-b border-line last:border-0" key={route.route}><td className="py-3 font-mono text-xs">{route.route}</td><td>{route.requests}</td><td>{route.server_errors}</td></tr>)}
          </tbody></table>{data.metrics.routes.length === 0 && <p className="text-sm text-ink-2 py-4">尚无请求数据</p>}</div>
        </section>
        <div className="grid gap-4 lg:grid-cols-2"><section className="card space-y-4"><h2 className="font-semibold">登录渠道</h2>
          {[{ label: '邮箱', enabled: data.authentication.email_enabled }, { label: '短信验证码', enabled: data.authentication.phone_enabled }, ...data.authentication.providers].map(provider => <div className="flex justify-between text-sm" key={provider.label}><span>{provider.label}</span><span className={provider.enabled ? 'text-green-700' : 'text-ink-2'}>{provider.enabled ? '已开放' : '未开放'}</span></div>)}
          <p className="text-xs text-ink-2">渠道开放状态来自部署配置，实际投递和授权依赖对应认证服务商。</p></section>
          <section className="card space-y-4"><h2 className="font-semibold">最近注册</h2>{data.recent_users.length ? data.recent_users.map(user => <div className="flex justify-between gap-3 text-sm" key={user.id}><span className="truncate">{user.display_name || 'Lifolio 用户'}</span><span className="text-ink-2 shrink-0">{new Date(user.created_at).toLocaleDateString('zh-CN')}</span></div>) : <p className="text-sm text-ink-2">暂无可显示的记录</p>}</section></div>
      </>}
    </div>
  </main>;
}
