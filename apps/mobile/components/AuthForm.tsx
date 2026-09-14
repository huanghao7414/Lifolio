import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { normalizePhone, type AuthConfig } from '@lifolio/shared-types';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { AUTH_REDIRECT_URL, startProviderLogin } from '@/lib/auth';
import { Colors } from '@/constants/colors';

export default function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sentPhone, setSentPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const loadConfig = () => {
    setConfigError(false);
    api.getAuthConfig().then(result => { if (mounted.current) setConfig(result); })
      .catch(() => { if (mounted.current) setConfigError(true); });
  };
  useEffect(() => { mounted.current = true; loadConfig(); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : '请求失败，请稍后重试'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const sendCode = () => run(async () => {
    if (!config?.phone_enabled) throw new Error('短信登录尚未启用');
    const number = normalizePhone(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone: number,
      options: { shouldCreateUser: register, data: register ? { display_name: name.trim() } : undefined } });
    if (error) throw error;
    setSentPhone(number); setCode(''); setCooldown(60); setNotice('验证码已发送，请查看手机短信');
  });
  const submit = () => run(async () => {
    if (method === 'phone') {
      if (!sentPhone || normalizePhone(phone) !== sentPhone) throw new Error('请先获取当前手机号的验证码');
      if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位短信验证码');
      const { data, error } = await supabase.auth.verifyOtp({ phone: sentPhone, token: code, type: 'sms' });
      if (error) throw error;
      if (!data.session) throw new Error('验证未完成，请重新获取验证码');
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('请输入有效邮箱');
      if (!password || (register && password.length < 8)) throw new Error('请填写密码，注册密码至少 8 位');
      if (register) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: AUTH_REDIRECT_URL } });
        if (error) throw error;
        if (!data.session) { setNotice('请在当前设备打开验证邮件，完成邮箱验证后再登录。'); return; }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) throw new Error('登录未完成，请重试');
      }
    }
    router.replace('/(tabs)');
  });
  const disabled = busy || (method === 'phone' && !sentPhone);
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.heading}><Text style={styles.brand}>Lifolio · 量化人生簿</Text><Text style={styles.title}>{register ? '创建账户' : '欢迎回来'}</Text><Text style={styles.muted}>记录生活，看见每一份价值</Text></View>
        <View style={styles.row}>{(['email', 'phone'] as const).map(value => <Pressable key={value} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: method === value }}
          onPress={() => { setMethod(value); setError(''); setNotice(''); }} style={[styles.segment, method === value && styles.selected]}><Text style={method === value ? styles.brand : styles.muted}>{value === 'email' ? '邮箱' : '手机验证码'}</Text></Pressable>)}</View>
        {register && <View style={styles.field}><Text style={styles.label}>昵称</Text><TextInput accessibilityLabel="昵称" style={styles.input} value={name} onChangeText={setName} maxLength={80} /></View>}
        {method === 'email' ? <>
          <View style={styles.field}><Text style={styles.label}>邮箱</Text><TextInput accessibilityLabel="邮箱" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" placeholderTextColor={Colors.textTertiary} /></View>
          <View style={styles.field}><Text style={styles.label}>密码</Text><TextInput accessibilityLabel="密码" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? '至少 8 位' : '输入密码'} placeholderTextColor={Colors.textTertiary} /></View>
        </> : <>
          <View style={styles.field}><Text style={styles.label}>手机号</Text><TextInput accessibilityLabel="手机号" style={styles.input} value={phone} onChangeText={text => { setPhone(text); setSentPhone(''); setCode(''); }} keyboardType="phone-pad" autoComplete="tel" placeholder="+86 13812345678" placeholderTextColor={Colors.textTertiary} /></View>
          <Text style={styles.small}>大陆手机号可直接输入 11 位，其他地区请包含国家区号。</Text>
          <View style={styles.row}><TextInput accessibilityLabel="短信验证码" style={[styles.input, { flex: 1 }]} value={code} onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} placeholder="6 位验证码" placeholderTextColor={Colors.textTertiary} />
            <Pressable accessibilityRole="button" onPress={sendCode} disabled={busy || cooldown > 0 || !config?.phone_enabled} style={[styles.codeButton, (busy || cooldown > 0 || !config?.phone_enabled) && styles.disabled]}><Text style={styles.brand}>{cooldown ? `${cooldown} 秒后重发` : '获取验证码'}</Text></Pressable></View>
          {config && !config.phone_enabled && <Text style={styles.small}>短信登录暂未开放，请使用邮箱。</Text>}
        </>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
        <Pressable accessibilityRole="button" disabled={disabled} onPress={submit} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{busy ? '处理中…' : register ? '注册并验证' : '登录'}</Text></Pressable>
        {configError && <Pressable onPress={loadConfig}><Text style={styles.small}>其他登录方式暂不可用，点击重试</Text></Pressable>}
        {config && <><Text style={[styles.small, { textAlign: 'center' }]}>也可以通过以下账号继续</Text><View style={styles.row}>{config.providers.map(provider => <Pressable key={provider.id} accessibilityRole="button" disabled={busy || !provider.enabled} style={[styles.provider, !provider.enabled && styles.disabled]} onPress={() => run(() => startProviderLogin(provider))}>
          <Text style={styles.label}>{provider.label}</Text>{!provider.enabled && <Text style={styles.small}>暂未开放</Text>}</Pressable>)}</View></>}
        <Pressable onPress={() => router.replace(register ? '/(auth)/login' : '/(auth)/register')} style={styles.link}><Text style={styles.muted}>{register ? '已有账户？' : '还没有账户？'}<Text style={styles.brand}>{register ? '登录' : '注册'}</Text></Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, padding: 28, paddingVertical: 40, gap: 16, justifyContent: 'center' },
  heading: { alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '700', color: Colors.text },
  brand: { color: Colors.brandText, fontWeight: '600', fontSize: 14 },
  muted: { color: Colors.textSecondary, fontSize: 14 }, small: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  field: { gap: 6 }, label: { color: Colors.text, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 }, segment: { flex: 1, alignItems: 'center', padding: 13, backgroundColor: Colors.surface, borderRadius: 12 },
  selected: { borderWidth: 1, borderColor: Colors.brandText },
  input: { minHeight: 48, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.text },
  button: { alignItems: 'center', backgroundColor: Colors.brand, padding: 16, borderRadius: 14 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }, disabled: { opacity: .5 },
  codeButton: { justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: Colors.surface },
  provider: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  error: { color: Colors.error, fontSize: 14 }, notice: { color: Colors.text, backgroundColor: Colors.surface, padding: 14, borderRadius: 12, lineHeight: 22 },
  link: { alignItems: 'center', padding: 12 },
});
