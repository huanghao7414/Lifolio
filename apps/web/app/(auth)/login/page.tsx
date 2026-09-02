'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setResetSent(true);
    }
  };

  if (mode === 'reset') {
    return (
      <div className="card p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">重置密码</h1>
          <p className="text-sm text-ink-2 mt-1">输入邮箱，我们将发送重置链接</p>
        </div>

        {resetSent ? (
          <div className="text-center space-y-4">
            <p className="text-green-600 text-sm">重置链接已发送，请检查邮箱。</p>
            <button onClick={() => { setMode('login'); setResetSent(false); }} className="text-accent-text text-sm font-semibold">
              返回登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:shadow-focus"
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full text-center">
              {loading ? '发送中...' : '发送重置链接'}
            </button>
            <button type="button" onClick={() => setMode('login')} className="w-full text-center text-sm text-ink-2">
              返回登录
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="card p-8 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Lifolio</h1>
        <p className="text-sm text-ink-2 mt-1">量化你的生活，看见你的价值</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">邮箱</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:shadow-focus"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">密码</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:shadow-focus"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full text-center">
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <div className="flex justify-between text-sm text-ink-2">
        <button onClick={() => setMode('reset')} className="text-accent-text font-medium">忘记密码？</button>
        <Link href="/register" className="text-accent-text font-semibold">注册账户</Link>
      </div>
    </div>
  );
}
