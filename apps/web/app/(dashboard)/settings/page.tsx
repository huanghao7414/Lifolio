'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAPIClient } from '@/lib/api';
import type { UserProfile } from '@lifolio/shared-types';
import LLMSettingsCard from '@/components/settings/LLMSettingsCard';

const TONES = [
  { value: 'casual', label: '轻松' },
  { value: 'professional', label: '专业' },
  { value: 'strict', label: '严格' },
] as const;

const FREQS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'realtime', label: '实时' },
] as const;

const messageFor = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试。';

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAPIClient().getProfile();
      setProfile(result);
      setBudget(result.monthly_budget == null ? '' : String(result.monthly_budget));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const change = (update: Partial<UserProfile>) => {
    setProfile(previous => previous ? { ...previous, ...update } : previous);
    setSaved(false);
    setError('');
  };

  const save = async () => {
    if (!profile || saving) return;
    setError('');
    setSaved(false);
    const amount = budget.trim() ? Number(budget) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setError('月预算须为大于或等于 0 的有效金额。');
      return;
    }
    const currency = profile.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setError('请填写三位货币代码，例如 CNY、USD。');
      return;
    }
    setSaving(true);
    try {
      const result = await getAPIClient().updateProfile({
        monthly_budget: amount,
        ai_tone: profile.ai_tone,
        ai_push_frequency: profile.ai_push_frequency,
        currency,
      });
      setProfile(result);
      setBudget(result.monthly_budget == null ? '' : String(result.monthly_budget));
      setSaved(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setError('');
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      window.location.href = '/login';
    } catch (err) {
      setError(messageFor(err));
      setSigningOut(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-h1 font-bold">设置</h1><p className="text-callout text-ink-2 mt-1">管理预算、AI 偏好和模型服务。</p></div>
      <form className="space-y-6" onSubmit={event => { event.preventDefault(); void save(); }}>
        {loading && <div className="card text-ink-2" role="status">正在加载个人设置…</div>}
        {!loading && !profile && <div className="card space-y-3"><p className="text-callout">暂时无法加载个人设置。</p><button type="button" onClick={() => void load()} className="btn-secondary">重新加载</button></div>}
        {profile && <fieldset disabled={loading || saving} className="space-y-6 disabled:opacity-60">
          <section className="card space-y-4">
            <h2 className="font-semibold">基本设置</h2>
            <div>
              <label htmlFor="monthly-budget" className="block text-caption font-medium mb-1">月预算（{profile.currency || 'CNY'}）</label>
              <input id="monthly-budget" type="number" min="0" step="0.01" value={budget} onChange={event => { setBudget(event.target.value); setSaved(false); setError(''); }} className="input" placeholder="尚未设置" />
              <p className="text-caption text-ink-2 mt-1">填写每月计划支出的金额；留空保持当前预算。</p>
            </div>
            <div>
              <label htmlFor="profile-currency" className="block text-caption font-medium mb-1">货币单位</label>
              <input id="profile-currency" value={profile.currency} onChange={event => change({ currency: event.target.value.toUpperCase() })} className="input" maxLength={3} required placeholder="CNY" />
            </div>
          </section>
          <section className="card space-y-4">
            <h2 className="font-semibold">AI 偏好</h2>
            <fieldset>
              <legend className="text-caption font-medium mb-2">AI 语气</legend>
              <div className="flex gap-2">{TONES.map(({ value, label }) => <button type="button" key={value} onClick={() => change({ ai_tone: value })} aria-pressed={profile.ai_tone === value} className={`flex-1 min-h-touch py-2 rounded-md text-callout font-medium transition-colors ${profile.ai_tone === value ? 'bg-accent-strong text-white' : 'bg-canvas text-ink-2'}`}>{label}</button>)}</div>
            </fieldset>
            <fieldset>
              <legend className="text-caption font-medium mb-2">推送频率</legend>
              <div className="flex gap-2">{FREQS.map(({ value, label }) => <button type="button" key={value} onClick={() => change({ ai_push_frequency: value })} aria-pressed={profile.ai_push_frequency === value} className={`flex-1 min-h-touch py-2 rounded-md text-callout font-medium transition-colors ${profile.ai_push_frequency === value ? 'bg-accent-strong text-white' : 'bg-canvas text-ink-2'}`}>{label}</button>)}</div>
            </fieldset>
          </section>
          <button disabled={saving} className="btn-primary w-full">{saving ? '保存中…' : '保存个人设置'}</button>
        </fieldset>}
        {error && <p role="alert" className="text-caption text-danger bg-danger-soft rounded-md p-3">{error}</p>}
        {saved && <p role="status" className="text-caption text-success">个人设置已保存。</p>}
      </form>
      <LLMSettingsCard />
      <button onClick={() => void signOut()} disabled={signingOut} className="btn-danger w-full disabled:opacity-40">{signingOut ? '退出中…' : '退出登录'}</button>
    </div>
  );
}
