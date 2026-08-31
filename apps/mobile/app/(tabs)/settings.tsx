import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import type { UserProfile } from '@lifolio/shared-types';
import { Colors } from '@/constants/colors';

const TONES = [
  { value: 'casual', label: '轻松' },
  { value: 'professional', label: '专业' },
  { value: 'strict', label: '严格' },
] as const;

export default function SettingsScreen() {
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        monthly_budget: profile.monthly_budget,
        ai_tone: profile.ai_tone,
        ai_push_frequency: profile.ai_push_frequency,
        currency: profile.currency,
      });
      Alert.alert('已保存', '设置已更新');
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>设置</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本设置</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>月预算（¥）</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={profile.monthly_budget?.toString() ?? ''}
              onChangeText={v => setProfile(p => ({ ...p, monthly_budget: Number(v) }))}
              placeholder="8000"
              placeholderTextColor={Colors.textTertiary}
            />
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>货币单位</Text>
            <TextInput
              style={styles.input}
              value={profile.currency ?? 'CNY'}
              onChangeText={v => setProfile(p => ({ ...p, currency: v }))}
              maxLength={3}
              autoCapitalize="characters"
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
                <Pressable
                  key={value}
                  style={[styles.toggleBtn, profile.ai_tone === value && styles.toggleBtnActive]}
                  onPress={() => setProfile(p => ({ ...p, ai_tone: value }))}
                >
                  <Text style={[styles.toggleLabel, profile.ai_tone === value && { color: '#fff' }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存设置'}</Text>
        </Pressable>

        <Pressable onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>退出登录</Text>
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
  sectionTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 4 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  input: { fontSize: 16, color: Colors.text, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  divider: { height: 12 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.brand },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { backgroundColor: Colors.brand, borderRadius: 16, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  signOutBtn: { alignItems: 'center', paddingVertical: 12 },
  signOutText: { color: Colors.error, fontSize: 15 },
});
