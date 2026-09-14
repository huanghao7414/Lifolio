'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { normalizePhone, type AuthConfig, type AuthProvider } from '@lifolio/shared-types';
import { createClient } from '@/lib/supabase/client';
import { getAPIClient } from '@/lib/api';

export default function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sentPhone, setSentPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const lock = useRef(false);

  const loadConfig = () => {
    setConfigError(false);
    getAPIClient().getAuthConfig().then(setConfig).catch(() => setConfigError(true));
  };
  useEffect(() => {
    loadConfig();
    if (new URLSearchParams(window.location.search).has('auth_error')) setError('验证链接已失效或登录未完成，请重新尝试');
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : '请求失败，请稍后重试'); }
    finally { lock.current = false; setBusy(false); }
  };
  const finish = () => { router.replace('/dashboard'); router.refresh(); };
  const sendCode = () => run(async () => {
    if (!config?.phone_enabled) throw new Error('短信登录尚未启用');
    const number = normalizePhone(phone);
    const { error } = await createClient().auth.signInWithOtp({
      phone: number, options: { shouldCreateUser: register, data: register ? { display_name: name.trim() } : undefined },
    });
    if (error) throw error;
    setSentPhone(number); setOtp(''); setCooldown(60); setNotice('验证码已发送，请查看手机短信');
  });
  const submit = () => run(async () => {
    const supabase = createClient();
    if (method === 'phone') {
      if (!sentPhone || normalizePhone(phone) !== sentPhone) throw new Error('请先获取当前手机号的验证码');
      if (!/^\d{6}$/.test(otp.trim())) throw new Error('请输入 6 位短信验证码');
      const { data, error } = await supabase.auth.verifyOtp({ phone: sentPhone, token: otp.trim(), type: 'sms' });
      if (error) throw error;
      if (!data.session) throw new Error('验证未完成，请重新获取验证码');
      finish(); return;
    }
    if (register) {
      if (password.length < 8) throw new Error('密码至少需要 8 位');
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
      if (data.session) finish();
      else setNotice('请查看邮箱中的验证邮件，完成验证后再登录。未收到时请检查垃圾邮件。');
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) throw new Error('登录未完成，请重试');
      finish();
    }
  });
  const resetPassword = () => run(async () => {
    if (!email.trim()) throw new Error('请先填写注册邮箱');
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) throw error;
    setNotice('如该邮箱可以找回密码，你将收到重置邮件。请在当前浏览器打开邮件链接。');
  });
  const oauth = (provider: AuthProvider) => run(async () => {
    if (!provider.enabled || !provider.provider) return;
    const { error } = await createClient().auth.signInWithOAuth({
      provider: provider.provider, options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  });
  const inputClass = 'w-full border border-line rounded-xl px-4 py-3 bg-canvas focus:outline-none focus:border-accent';

  return <div className="card p-6 sm:p-8 space-y-5">
    <div className="text-center"><p className="text-accent-text text-sm font-semibold mb-2">Lifolio · 量化人生簿</p>
      <h1 className="text-2xl font-bold">{register ? '创建账户' : '欢迎回来'}</h1>
      <p className="text-sm text-ink-2 mt-2">{register ? '让每一笔花费、每一件物品都有迹可循' : '登录后继续记录你的生活'}</p></div>
    <div className="flex gap-2" role="group" aria-label="登录方式">
      {(['email', 'phone'] as const).map(value => <button key={value} disabled={busy} aria-pressed={method === value}
        onClick={() => { setMethod(value); setError(''); setNotice(''); }}
        className={`flex-1 rounded-xl py-3 text-sm font-medium ${method === value ? 'bg-accent-soft text-accent-text' : 'bg-canvas text-ink-2'}`}>
        {value === 'email' ? '邮箱' : '手机验证码'}</button>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-4">
      {register && <label className="block text-sm">昵称<input className={`${inputClass} mt-1`} value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="nickname" /></label>}
      {method === 'email' ? <>
        <label className="block text-sm">邮箱<input className={`${inputClass} mt-1`} value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="you@example.com" /></label>
        <label className="block text-sm">密码<input className={`${inputClass} mt-1`} value={password} onChange={e => setPassword(e.target.value)} type="password" required minLength={register ? 8 : undefined} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? '至少 8 位' : '输入密码'} /></label>
      </> : <>
        <label className="block text-sm">手机号<input className={`${inputClass} mt-1`} value={phone} onChange={e => { setPhone(e.target.value); setSentPhone(''); setOtp(''); }} type="tel" required autoComplete="tel" placeholder="+86 13812345678" /></label>
        <p className="text-xs text-ink-2">中国大陆手机号可直接输入 11 位；其他地区请包含国家区号。</p>
        <div className="flex gap-2 items-end"><label className="block text-sm flex-1 min-w-0">短信验证码<input className={`${inputClass} mt-1`} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
          <button type="button" onClick={sendCode} disabled={busy || cooldown > 0 || !config?.phone_enabled} className="py-3 px-3 text-sm text-accent-text bg-accent-soft rounded-xl disabled:opacity-50">{cooldown ? `${cooldown} 秒后重发` : '获取验证码'}</button></div>
        {config && !config.phone_enabled && <p className="text-sm text-ink-2">短信登录暂未开放，请使用邮箱。</p>}
      </>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-700 bg-green-50 rounded-xl p-3">{notice}</p>}
      <button type="submit" disabled={busy || (method === 'phone' && !sentPhone)} className="btn-primary w-full disabled:opacity-50">{busy ? '处理中…' : register ? '注册并验证' : '登录'}</button>
    </form>
    {!register && method === 'email' && <button type="button" onClick={resetPassword} disabled={busy} className="text-sm text-accent-text">忘记密码？</button>}
    {configError && <p role="status" className="text-xs text-ink-2">其他登录方式暂不可用。<button onClick={loadConfig} className="text-accent-text ml-1">重试</button></p>}
    {config && <div className="border-t border-line pt-4 space-y-3"><p className="text-xs text-ink-2 text-center">也可以通过以下账号继续</p>
      <div className="flex gap-2">{config.providers.map(provider => <button key={provider.id} onClick={() => oauth(provider)} disabled={busy || !provider.enabled}
        className="flex-1 border border-line rounded-xl p-3 text-sm disabled:opacity-50">{provider.label}{!provider.enabled && <span className="block text-xs mt-1">暂未开放</span>}</button>)}</div></div>}
    <p className="text-center text-sm text-ink-2">{register ? '已有账户？' : '还没有账户？'} <Link className="text-accent-text font-semibold" href={register ? '/login' : '/register'}>{register ? '登录' : '注册'}</Link></p>
  </div>;
}
