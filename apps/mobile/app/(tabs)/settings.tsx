import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import type { UserProfile } from '@lifolio/shared-types';
import { Colors } from '@/constants/colors';
import LLMSettingsCard from '@/components/LLMSettingsCard';

const TONES = [
  { value: 'casual', label: '轻松' },
  { value: 'professional', label: '专业' },
  { value: 'strict', label: '严格' },
] as const;
const FREQUENCIES = [
  { value: 'realtime', label: '实时' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
] as const;

export default function SettingsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const operation = useRef(0);
  const saveLocked = useRef(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const current = ++operation.current;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api.getProfile();
      if (!mounted.current || current !== operation.current) return;
      setProfile(data);
      setBudget(data.monthly_budget == null ? '' : String(data.monthly_budget));
    } catch (cause) {
      if (mounted.current && current === operation.current) setError(cause instanceof Error ? cause.message : '设置加载失败，请重试。');
    } finally {
      if (mounted.current && current === operation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; operation.current += 1; };
  }, [load]);

  const update = (value: Partial<UserProfile>) => {
    setProfile(current => current ? { ...current, ...value } : null);
    setNotice(null);
    setError(null);
  };

  const save = async () => {
    if (!profile || loading || saveLocked.current) return;
    setError(null);
    setNotice(null);
    const amount = budget.trim() ? Number(budget) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setError('月预算需要是大于或等于 0 的有效金额。');
      return;
    }
    const currency = profile.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setError('请输入三个英文字母的货币代码，例如 CNY 或 USD。');
      return;
    }
    saveLocked.current = true;
    setSaving(true);
    try {
      const saved = await api.updateProfile({
        ...(amount !== undefined ? { monthly_budget: amount } : {}),
        ai_tone: profile.ai_tone,
        ai_push_frequency: profile.ai_push_frequency,
        currency,
      });
      if (!mounted.current) return;
      setProfile(saved);
      setBudget(saved.monthly_budget == null ? '' : String(saved.monthly_budget));
      setNotice('基本设置和 AI 偏好已保存。');
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '设置保存失败，请重试。');
    } finally {
      saveLocked.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace('/(auth)/login');
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '退出登录失败，请重试。');
    } finally {
      if (mounted.current) setSigningOut(false);
    }
  };

  const disabled = saving || signingOut;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>设置</Text>
        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={Colors.brand} /><Text style={styles.help}>正在加载基本设置…</Text></View>
        ) : profile ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>基本设置</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>月预算（{profile.currency || 'CNY'}）</Text>
                <TextInput
                  accessibilityLabel="月预算"
                  editable={!disabled}
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={budget}
                  onChangeText={value => { setBudget(value); setNotice(null); setError(null); }}
                  placeholder="输入预算金额"
                  placeholderTextColor={Colors.textTertiary}
                />
                <Text style={styles.help}>留空保留原预算。</Text>
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>货币单位</Text>
                <TextInput
                  accessibilityLabel="货币代码"
                  editable={!disabled}
                  style={styles.input}
                  value={profile.currency ?? 'CNY'}
                  onChangeText={currency => update({ currency })}
                  maxLength={3}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="CNY"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AI 偏好</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>AI 语气</Text>
                <View style={styles.toggleRow}>
                  {TONES.map(({ value, label }) => (
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: profile.ai_tone === value }} disabled={disabled}
                      key={value} style={[styles.toggleBtn, profile.ai_tone === value && styles.toggleBtnActive]} onPress={() => update({ ai_tone: value })}>
                      <Text style={[styles.toggleLabel, profile.ai_tone === value && styles.activeLabel]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>AI 提醒频率</Text>
                <View style={styles.toggleRow}>
                  {FREQUENCIES.map(({ value, label }) => (
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: profile.ai_push_frequency === value }} disabled={disabled}
                      key={value} style={[styles.toggleBtn, profile.ai_push_frequency === value && styles.toggleBtnActive]} onPress={() => update({ ai_push_frequency: value })}>
                      <Text style={[styles.toggleLabel, profile.ai_push_frequency === value && styles.activeLabel]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </>
        ) : null}
        {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text>}
        {!loading && !profile ? (
          <Pressable accessibilityRole="button" style={styles.saveBtn} onPress={() => void load()}><Text style={styles.saveBtnText}>重新加载基本设置</Text></Pressable>
        ) : (
          <Pressable accessibilityRole="button" style={[styles.saveBtn, (disabled || loading) && styles.disabled]} onPress={() => void save()} disabled={disabled || loading}>
            <Text style={styles.saveBtnText}>{saving ? '保存中…' : '保存基本设置与偏好'}</Text>
          </Pressable>
        )}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI 模型配置</Text>
          <LLMSettingsCard />
        </View>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void signOut()} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>{signingOut ? '正在退出…' : '退出登录'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 20, paddingBottom: 60 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: Colors.text },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 4 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  input: { minHeight: 44, fontSize: 16, color: Colors.text, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  help: { fontSize: 12, lineHeight: 20, color: Colors.textSecondary },
  divider: { height: 12 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  toggleBtn: { flex: 1, minHeight: 44, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: Colors.brand },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  activeLabel: { color: '#fff' },
  saveBtn: { backgroundColor: Colors.brand, borderRadius: 16, padding: 16, alignItems: 'center', minHeight: 44 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  signOutBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  signOutText: { color: Colors.error, fontSize: 15 },
  disabled: { opacity: 0.45 },
  error: { color: Colors.error, fontSize: 13, lineHeight: 20 },
  success: { color: Colors.success, fontSize: 13, lineHeight: 20 },
  loading: { alignItems: 'center', gap: 12, padding: 20 },
});
