import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeAuthCallback } from '@/lib/auth';
import { Colors } from '@/constants/colors';

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error) query.set('error', '1');
    completeAuthCallback(`lifolio://callback?${query}`).then(() => {
      if (active) router.replace('/(tabs)');
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : '验证失败，请重试'); });
    return () => { active = false; };
  }, [params.code, params.error, router]);
  return <View style={{ flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center', gap: 20, backgroundColor: Colors.background }}>
    {error ? <><Text accessibilityRole="alert" style={{ color: Colors.error }}>{error}</Text><Pressable onPress={() => router.replace('/(auth)/login')}><Text style={{ color: Colors.brandText }}>返回登录</Text></Pressable></> : <><ActivityIndicator /><Text>正在验证登录…</Text></>}
  </View>;
}
