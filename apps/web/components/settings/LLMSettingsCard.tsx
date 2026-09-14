'use client';

import { useCallback, useEffect, useState } from 'react';
import { LLM_PROVIDER_PRESETS } from '@lifolio/shared-types';
import type { LLMProvider, LLMSettings, LLMSettingsUpdate } from '@lifolio/shared-types';
import { getAPIClient } from '@/lib/api';

type Draft = {
  provider: LLMProvider;
  base_url: string;
  api_key: string;
  chat_model: string;
  vision_model: string;
  temperature: number;
  is_enabled: boolean;
};

const messageFor = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试。';
const draftFrom = (settings: LLMSettings): Draft => ({
  provider: LLM_PROVIDER_PRESETS.some(item => item.value === settings.provider) ? settings.provider as LLMProvider : 'custom',
  base_url: settings.base_url ?? '',
  api_key: '',
  chat_model: settings.chat_model,
  vision_model: settings.vision_model ?? '',
  temperature: settings.temperature,
  is_enabled: settings.is_enabled,
});

export default function LLMSettingsCard() {
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'save' | 'test' | 'reset' | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAPIClient().getLLMSettings();
      setSettings(result);
      setDraft(draftFrom(result));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(previous => previous ? { ...previous, [key]: value } : previous);
    setStatus('');
    setError('');
    setConfirmReset(false);
  };

  const selectProvider = (value: LLMProvider) => {
    const preset = LLM_PROVIDER_PRESETS.find(item => item.value === value);
    setDraft(previous => previous ? {
      ...previous,
      provider: value,
      base_url: preset?.base_url ?? '',
      chat_model: preset?.chat_model ?? '',
      vision_model: '',
      api_key: '',
    } : previous);
    setError('');
    setStatus('');
    setConfirmReset(false);
  };

  const payload = (testing: boolean): LLMSettingsUpdate | null => {
    if (!draft) return null;
    if (!draft.chat_model.trim()) {
      setError('请填写对话模型名称。');
      return null;
    }
    if (draft.base_url.trim()) {
      try {
        const url = new URL(draft.base_url.trim());
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      } catch {
        setError('API 地址须为有效的公共 HTTPS 地址，且不能包含用户名或密码。');
        return null;
      }
    } else if (draft.provider === 'custom') {
      setError('请填写自定义服务的 API 地址。');
      return null;
    }
    const needsKey = !settings?.has_key || settings.provider !== draft.provider;
    if ((draft.is_enabled || testing) && needsKey && !draft.api_key.trim()) {
      setError(settings?.provider !== draft.provider ? '更换服务商后，请填写对应服务商的 API Key。' : '请先填写 API Key。');
      return null;
    }
    if (!Number.isFinite(draft.temperature) || draft.temperature < 0 || draft.temperature > 2) {
      setError('随机性须在 0 到 2 之间。');
      return null;
    }
    return {
      provider: draft.provider,
      base_url: draft.base_url.trim(),
      chat_model: draft.chat_model.trim(),
      vision_model: draft.vision_model.trim(),
      temperature: draft.temperature,
      is_enabled: draft.is_enabled,
      ...(draft.api_key.trim() ? { api_key: draft.api_key.trim() } : {}),
    };
  };

  const save = async () => {
    if (action) return;
    setError('');
    setStatus('');
    const update = payload(false);
    if (!update) return;
    setAction('save');
    try {
      const result = await getAPIClient().updateLLMSettings(update);
      setSettings(result);
      setDraft(draftFrom(result));
      setShowKey(false);
      setStatus(result.source === 'user' ? '已保存，正在使用你的模型配置。' : result.source === 'unconfigured' ? '已保存，尚无可用的 AI 配置。请启用并配置 API Key。' : '已保存。当前使用平台默认配置。');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setAction(null);
    }
  };

  const test = async () => {
    if (action) return;
    setError('');
    setStatus('');
    const update = payload(true);
    if (!update) return;
    setAction('test');
    try {
      const result = await getAPIClient().testLLMSettings(update);
      if (!result.ok) throw new Error('服务未返回有效响应，请检查配置。');
      setStatus(`连接成功：${result.model}。本次测试使用当前填写的配置，尚未保存。`);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setAction(null);
    }
  };

  const reset = async () => {
    if (action) return;
    setAction('reset');
    setError('');
    setStatus('');
    try {
      await getAPIClient().deleteLLMSettings();
      setConfirmReset(false);
      setShowKey(false);
      // Drop the key immediately even if reloading the defaults fails.
      setDraft(null);
      setSettings(null);
      await load();
      setStatus('已移除自定义配置和保存的 API Key。');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setAction(null);
    }
  };

  return (
    <section className="card space-y-5" aria-labelledby="llm-settings-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="llm-settings-title" className="font-semibold">AI 模型配置</h2>
          <p className="text-caption text-ink-2 mt-1">连接自己的模型服务，用于 AI 对话与分析。</p>
        </div>
        {settings && <span className={`badge shrink-0 ${settings.source === 'user' ? 'badge-high' : settings.source === 'unconfigured' ? 'badge-danger' : 'badge-info'}`}>
          {settings.source === 'user' ? '自定义模型' : settings.source === 'unconfigured' ? '尚未配置' : '平台默认'}
        </span>}
      </div>
      {loading && <p role="status" className="text-callout text-ink-2">正在加载模型配置…</p>}
      {!loading && !draft && <button onClick={() => void load()} className="btn-secondary">重新加载</button>}
      {!loading && draft && <>
        <fieldset disabled={action !== null} className="space-y-4 disabled:opacity-60">
          <label className="flex items-center justify-between gap-4 p-3 rounded-md bg-canvas">
            <span><span className="block text-callout font-medium">启用自定义模型</span><span className="block text-caption text-ink-2 mt-1">关闭后使用平台默认配置</span></span>
            <input type="checkbox" checked={draft.is_enabled} onChange={event => change('is_enabled', event.target.checked)} className="w-5 h-5 accent-accent-strong" />
          </label>
          <div>
            <label htmlFor="llm-provider" className="block text-caption font-medium mb-1">模型服务商</label>
            <select id="llm-provider" value={draft.provider} onChange={event => selectProvider(event.target.value as LLMProvider)} className="input">
              {LLM_PROVIDER_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="llm-base-url" className="block text-caption font-medium mb-1">API 地址（Base URL）</label>
            <input id="llm-base-url" type="url" value={draft.base_url} onChange={event => change('base_url', event.target.value)} placeholder="https://api.example.com/v1" autoComplete="off" spellCheck={false} className="input" />
            <p className="text-caption text-ink-2 mt-1">使用兼容 OpenAI 接口的公共 HTTPS 地址。</p>
          </div>
          <div>
            <label htmlFor="llm-api-key" className="block text-caption font-medium mb-1">API Key</label>
            <div className="flex gap-2">
              <input id="llm-api-key" type={showKey ? 'text' : 'password'} value={draft.api_key} onChange={event => change('api_key', event.target.value)} placeholder={settings?.has_key && settings.provider === draft.provider ? `已保存 ${settings.key_hint ?? '密钥'}，留空保持不变` : '输入服务商提供的 API Key'} autoComplete="new-password" spellCheck={false} className="input min-w-0" aria-describedby="llm-key-help" />
              <button type="button" onClick={() => setShowKey(value => !value)} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} aria-pressed={showKey} className="btn-secondary shrink-0">{showKey ? '隐藏' : '显示'}</button>
            </div>
            <p id="llm-key-help" className="text-caption text-ink-2 mt-1">密钥加密保存；留空不会清除已保存的密钥。更换服务商时需填写新的密钥。</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label htmlFor="llm-chat-model" className="block text-caption font-medium mb-1">对话模型</label><input id="llm-chat-model" value={draft.chat_model} onChange={event => change('chat_model', event.target.value)} spellCheck={false} className="input" placeholder="填写模型名称" /></div>
            <div><label htmlFor="llm-vision-model" className="block text-caption font-medium mb-1">图片识别模型（可选）</label><input id="llm-vision-model" value={draft.vision_model} onChange={event => change('vision_model', event.target.value)} spellCheck={false} className="input" placeholder="支持图片的模型名称" /></div>
          </div>
          <div>
            <label htmlFor="llm-temperature" className="flex justify-between text-caption font-medium mb-2"><span>回答随机性</span><span className="tnum">{draft.temperature.toFixed(1)}</span></label>
            <input id="llm-temperature" type="range" min="0" max="2" step="0.1" value={draft.temperature} onChange={event => change('temperature', Number(event.target.value))} className="w-full accent-accent-strong" />
            <div className="flex justify-between text-caption text-ink-2"><span>更稳定</span><span>更多样</span></div>
          </div>
        </fieldset>
        {settings?.last_error && <p className="text-caption text-danger break-words">上次连接错误：{settings.last_error}</p>}
        {settings?.last_verified_at && <p className="text-caption text-ink-2">上次验证：{new Date(settings.last_verified_at).toLocaleString('zh-CN')}</p>}
        <div className="flex flex-wrap gap-3">
          <button disabled={action !== null} onClick={() => void test()} className="btn-secondary">{action === 'test' ? '正在测试…' : '测试当前配置'}</button>
          <button disabled={action !== null} onClick={() => void save()} className="btn-primary">{action === 'save' ? '保存中…' : '保存模型配置'}</button>
        </div>
        {(settings?.updated_at || settings?.has_key) && <div className="border-t border-line pt-3">
          {confirmReset ? <div className="rounded-md bg-danger-soft p-3 space-y-2" role="alert">
            <p className="text-caption text-ink-1">恢复平台默认将删除自定义配置和已保存的 API Key。</p>
            <div className="flex gap-2"><button disabled={action !== null} onClick={() => void reset()} className="btn-danger">{action === 'reset' ? '恢复中…' : '确认恢复默认'}</button><button disabled={action !== null} onClick={() => setConfirmReset(false)} className="btn-secondary">取消</button></div>
          </div> : <button disabled={action !== null} onClick={() => setConfirmReset(true)} className="btn-danger disabled:opacity-40">恢复平台默认</button>}
        </div>}
      </>}
      {error && <p role="alert" className="text-caption text-danger bg-danger-soft rounded-md p-3 break-words">{error}</p>}
      {status && <p role="status" className="text-caption text-success bg-success-soft rounded-md p-3">{status}</p>}
    </section>
  );
}
