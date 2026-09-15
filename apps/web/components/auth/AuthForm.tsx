'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { normalizePhone, type AuthConfig, type AuthProvider } from '@lifolio/shared-types';
import { createClient } from '@/lib/supabase/client';
import { getAPIClient } from '@/lib/api';
import { authErrorMessage } from '@/lib/auth-error';
import AuthIcon from './AuthIcon';

export default function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sentPhone, setSentPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    catch (err) { setError(authErrorMessage(err)); }
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
  const methodLabel = method === 'email' ? '邮箱登录' : '手机验证码登录';
  const inputClass = 'auth-input w-full min-h-[50px] rounded-xl border border-line bg-canvas/60 px-4 py-3 text-[15px] text-ink-1 placeholder:text-ink-3 focus:border-accent focus:outline-none transition-colors';
  const providers: AuthProvider[] = config?.providers ?? [
    { id: 'google', label: 'Google', enabled: false, provider: null, status: 'not_configured' },
    { id: 'wechat', label: '微信', enabled: false, provider: null, status: 'not_configured' },
  ];
  const unavailable = providers.filter(provider => !provider.enabled).map(provider => provider.label);
  const chooseMethod = (value: 'email' | 'phone') => {
    setMethod(value); setError(''); setNotice('');
  };

  return <section className="auth-card rounded-[28px] border border-line/80 bg-surface p-6 sm:p-7" aria-labelledby="auth-heading">
    <header className="mb-6 text-center">
      <div className="inline-flex items-center gap-2.5 mb-5">
        <span className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-[11px] bg-accent-strong text-white"><AuthIcon name="brand" className="h-6 w-6" /></span>
        <span className="text-[21px] font-semibold tracking-[-0.04em]">Lifolio</span>
      </div>
      <h1 id="auth-heading" className="text-[28px] font-semibold tracking-[-0.035em] leading-tight">{register ? '开启你的生活簿' : '欢迎回来'}</h1>
      <p className="text-sm leading-relaxed text-ink-2 mt-2.5">{register ? '记录点滴，让生活的价值慢慢清晰。' : '继续记录，看见生活里的每一份价值。'}</p>
    </header>

    <div className="flex items-center justify-between gap-4 mb-5">
      <p className="text-sm font-medium text-ink-1" aria-live="polite">{register ? method === 'email' ? '使用邮箱注册' : '使用手机号注册' : methodLabel}</p>
      <div role="tablist" aria-label="登录方式" className="inline-flex gap-1 rounded-full border border-line/60 bg-canvas p-1">
        {(['email', 'phone'] as const).map(value => <button key={value} type="button" role="tab" id={`auth-method-${value}`}
          disabled={busy} aria-selected={method === value} aria-controls="auth-fields" tabIndex={method === value ? 0 : -1}
          aria-label={value === 'email' ? '邮箱登录' : '手机验证码登录'} title={value === 'email' ? '邮箱登录' : '手机验证码登录'}
          onClick={() => chooseMethod(value)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'email' : event.key === 'End' ? 'phone' : value === 'email' ? 'phone' : 'email';
            chooseMethod(next);
            document.getElementById(`auth-method-${next}`)?.focus();
          }}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all disabled:opacity-50 ${method === value ? 'bg-surface text-accent-text shadow-sm' : 'text-ink-2 hover:text-ink-1'}`}>
          <AuthIcon name={value} className="h-[19px] w-[19px]" />
        </button>)}
      </div>
    </div>

    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-5">
      <fieldset disabled={busy} id="auth-fields" role="tabpanel" aria-labelledby={`auth-method-${method}`} className="space-y-4 disabled:opacity-70">
        {register && <label className="block text-[13px] font-medium text-ink-2" htmlFor="auth-name">昵称<input id="auth-name" className={`${inputClass} mt-2 font-normal`} value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="nickname" placeholder="怎么称呼你" /></label>}
        {method === 'email' ? <>
          <label className="block text-[13px] font-medium text-ink-2" htmlFor="auth-email">邮箱<input id="auth-email" className={`${inputClass} mt-2 font-normal`} value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="you@example.com" /></label>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-ink-2" htmlFor="auth-password">密码</label>
              {!register && <button type="button" onClick={resetPassword} disabled={busy} className="text-xs text-ink-2 hover:text-accent-text transition-colors">忘记密码？</button>}
            </div>
            <div className="relative">
              <input id="auth-password" className={`${inputClass} pr-12`} value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required minLength={register ? 8 : undefined} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? '设置密码，至少 8 位' : '输入你的密码'} />
              <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} title={showPassword ? '隐藏密码' : '显示密码'} className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-ink-2 hover:text-ink-1"><AuthIcon name={showPassword ? 'eye-off' : 'eye'} className="h-[18px] w-[18px]" /></button>
            </div>
          </div>
        </> : <>
          <label className="block text-[13px] font-medium text-ink-2" htmlFor="auth-phone">手机号<input id="auth-phone" className={`${inputClass} mt-2 font-normal`} value={phone} onChange={e => { setPhone(e.target.value); setSentPhone(''); setOtp(''); }} type="tel" required autoComplete="tel" placeholder="+86 13812345678" aria-describedby="auth-phone-help" /></label>
          <p id="auth-phone-help" className="text-xs leading-relaxed text-ink-2">大陆手机号可直接输入 11 位，其他地区请添加国家区号。</p>
          <label className="block text-[13px] font-medium text-ink-2" htmlFor="auth-otp">短信验证码</label>
          <div className="relative !mt-2">
            <input id="auth-otp" className={`${inputClass} pr-28`} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="6 位验证码" />
            <button type="button" onClick={sendCode} disabled={busy || cooldown > 0 || !config?.phone_enabled} className="absolute right-3 top-1/2 -translate-y-1/2 min-h-11 text-xs font-medium text-accent-text disabled:text-ink-3">{cooldown ? `${cooldown} 秒后重发` : '获取验证码'}</button>
          </div>
          {config && !config.phone_enabled && <p className="text-xs text-ink-2">短信登录暂未开放，请使用邮箱。</p>}
        </>}
      </fieldset>
      {error && <p role="alert" className="text-sm leading-relaxed text-danger bg-danger-soft rounded-xl px-3.5 py-3">{error}</p>}
      {notice && <p role="status" className="text-sm leading-relaxed text-success bg-success-soft rounded-xl px-3.5 py-3">{notice}</p>}
      <button type="submit" disabled={busy || (method === 'phone' && !sentPhone)} className="btn-primary min-h-[50px] !rounded-xl w-full !text-sm">
        {busy ? '处理中…' : register ? '注册并验证' : '登录'}{!busy && <AuthIcon name="arrow" className="h-4 w-4 ml-1" />}
      </button>
    </form>

    <div className="mt-6">
      <div className="flex items-center gap-4 text-[11px] text-ink-2"><span className="h-px flex-1 bg-line" />其他方式继续<span className="h-px flex-1 bg-line" /></div>
      <div className="flex items-center justify-center gap-5 mt-4" role="group" aria-label="第三方登录">
        {providers.map(provider => <span key={provider.id} className="auth-provider group relative" title={`${provider.label}${provider.enabled ? '登录' : '登录暂未开放'}`}>
          <button type="button" onClick={() => oauth(provider)} disabled={busy || !provider.enabled} aria-label={`${provider.label}${provider.enabled ? '登录' : '登录，暂未开放'}`} aria-describedby={!provider.enabled ? 'auth-providers-status' : undefined}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface transition-all hover:bg-canvas hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed">
            <AuthIcon name={provider.id} className="h-[22px] w-[22px]" />
          </button>
          <span className="pointer-events-none absolute left-1/2 -top-8 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-1 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{provider.label}{!provider.enabled && ' · 暂未开放'}</span>
        </span>)}
      </div>
      <p id="auth-providers-status" className="text-center text-[11px] text-ink-2 mt-3 min-h-4" role="status">
        {configError ? <>暂时无法加载登录方式。<button onClick={loadConfig} className="text-accent-text ml-1">重试</button></> : !config ? '正在加载登录方式…' : unavailable.length ? `${unavailable.join('、')}登录暂未开放` : '选择你习惯的方式继续'}
      </p>
    </div>
    <p className="text-center text-[13px] text-ink-2 mt-6 pt-5 border-t border-line/70">{register ? '已有账户？' : '还没有账户？'} <Link className="text-accent-text font-medium ml-1 hover:underline" href={register ? '/login' : '/register'}>{register ? '去登录' : '创建账户'}</Link></p>
  </section>;
}
