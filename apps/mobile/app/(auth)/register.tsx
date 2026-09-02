import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (err) { setError(err.message); setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>创建账户</Text>
          <Text style={styles.tagline}>开始量化你的生活</Text>
        </View>

        <View style={styles.form}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="昵称" placeholderTextColor={Colors.textTertiary} />
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="邮箱" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textTertiary} />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="密码（8位以上）" secureTextEntry placeholderTextColor={Colors.textTertiary} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.btn} onPress={handleRegister} disabled={loading}>
            <Text style={styles.btnText}>{loading ? '注册中...' : '注册'}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.back()} style={styles.switchLink}>
          <Text style={styles.switchText}>已有账户？<Text style={{ color: Colors.brandText }}>登录</Text></Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, padding: 32, justifyContent: 'center', gap: 32 },
  logo: { alignItems: 'center', gap: 6 },
  logoText: { fontSize: 30, fontWeight: '700', color: Colors.text },
  tagline: { fontSize: 14, color: Colors.textTertiary },
  form: { gap: 12 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  error: { fontSize: 13, color: Colors.error },
  btn: { backgroundColor: Colors.brand, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchLink: { alignItems: 'center' },
  switchText: { fontSize: 14, color: Colors.textSecondary },
});
