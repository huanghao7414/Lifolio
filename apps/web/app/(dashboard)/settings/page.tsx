'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAPIClient } from '@/lib/api';
import type { UserProfile } from '@lifolio/shared-types';

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

export default function SettingsPage() {
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAPIClient().getProfile().then(setProfile);
  }, []);

  const save = async () => {
    setSaving(true);
    await getAPIClient().updateProfile({
      monthly_budget: profile.monthly_budget,
      ai_tone: profile.ai_tone,
      ai_push_frequency: profile.ai_push_frequency,
      currency: profile.currency,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>

      <section className="card space-y-4">
        <h2 className="font-semibold">基本设置</h2>

        <div>
          <label className="block text-sm font-medium mb-1">月预算（¥）</label>
          <input
            type="number"
            value={profile.monthly_budget ?? ''}
            onChange={e => setProfile(p => ({ ...p, monthly_budget: Number(e.target.value) }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
            placeholder="8000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">货币单位</label>
          <input
            type="text"
            value={profile.currency ?? 'CNY'}
            onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
            maxLength={3}
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">AI 偏好</h2>

        <div>
          <label className="block text-sm font-medium mb-2">AI 语气</label>
          <div className="flex gap-2">
            {TONES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setProfile(p => ({ ...p, ai_tone: value }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  profile.ai_tone === value ? 'bg-brand text-white' : 'bg-surface text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">推送频率</label>
          <div className="flex gap-2">
            {FREQS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setProfile(p => ({ ...p, ai_push_frequency: value }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  profile.ai_push_frequency === value ? 'bg-brand text-white' : 'bg-surface text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <button onClick={save} disabled={saving} className="btn-primary w-full">
        {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
      </button>

      <button onClick={signOut} className="w-full text-center text-sm text-red-500 py-2 hover:underline">
        退出登录
      </button>
    </div>
  );
}
