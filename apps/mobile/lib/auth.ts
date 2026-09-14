import * as WebBrowser from 'expo-web-browser';
import type { AuthProvider } from '@lifolio/shared-types';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();
export const AUTH_REDIRECT_URL = 'lifolio://callback';
let pending: { code: string; promise: Promise<void> } | null = null;

export function completeAuthCallback(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'lifolio:' || parsed.hostname !== 'callback') return Promise.reject(new Error('登录回调地址无效'));
  if (parsed.searchParams.has('error')) return Promise.reject(new Error('授权未完成，请重新尝试'));
  const code = parsed.searchParams.get('code');
  if (!code) return Promise.reject(new Error('验证链接已失效，请重新登录'));
  if (pending?.code === code) return pending.promise;
  const promise = (async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.session) throw new Error('登录未完成，请重试');
  })();
  pending = { code, promise };
  return promise;
}

export async function startProviderLogin(provider: AuthProvider) {
  if (!provider.enabled || !provider.provider) throw new Error('此登录方式暂未开放');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: provider.provider,
    options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true } });
  if (error) throw error;
  if (!data.url) throw new Error('无法打开授权页面');
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URL);
  if (result.type === 'success') await completeAuthCallback(result.url);
}
