import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LLM_PROVIDER_PRESETS, type LLMProvider, type LLMSettings, type LLMSettingsUpdate } from '@lifolio/shared-types';
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

type Draft = {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  visionModel: string;
  temperature: string;
  enabled: boolean;
};

const toDraft = (settings: LLMSettings): Draft => ({
  provider: settings.provider,
  baseUrl: settings.base_url ?? '',
  apiKey: '',
  chatModel: settings.chat_model,
  visionModel: settings.vision_model ?? '',
  temperature: String(settings.temperature),
  enabled: settings.is_enabled,
});

export default function LLMSettingsCard() {
  const [saved, setSaved] = useState<LLMSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<'save' | 'test' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const settings = await api.getLLMSettings();
      if (!mounted.current || current !== request.current) return;
      setSaved(settings);
      setDraft(toDraft(settings));
    } catch (cause) {
      if (mounted.current && current === request.current) setError(cause instanceof Error ? cause.message : '无法加载模型配置，请重试。');
    } finally {
      if (mounted.current && current === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; request.current += 1; };
  }, [load]);

  const update = (patch: Partial<Draft>) => {
    setDraft(value => value ? { ...value, ...patch } : value);
    setNotice(null);
    setError(null);
  };

  const selectProvider = (provider: LLMProvider) => {
    if (provider === draft?.provider) return;
    const preset = LLM_PROVIDER_PRESETS.find(item => item.value === provider);
    update({ provider, baseUrl: preset?.base_url ?? '', chatModel: preset?.chat_model ?? '', visionModel: '', apiKey: '' });
  };

  const buildUpdate = (): LLMSettingsUpdate => {
    if (!draft) throw new Error('请先加载模型配置。');
    const temperature = Number(draft.temperature);
    if (!draft.temperature.trim() || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw new Error('温度参数需要是 0 到 2 之间的数字。');
    }
    if (!draft.chatModel.trim()) throw new Error('请输入对话模型名称。');
    if (draft.provider === 'custom' && !draft.baseUrl.trim()) throw new Error('请输入兼容接口的 Base URL。');
    if (draft.baseUrl.trim()) {
      let url: URL;
      try { url = new URL(draft.baseUrl.trim()); } catch { throw new Error('请输入有效的 HTTPS 接口地址。'); }
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('接口地址需要使用不含用户名和密码的公共 HTTPS 地址。');
    }
    const retainedKey = saved?.has_key && saved.provider === draft.provider;
    if (draft.enabled && !draft.apiKey.trim() && !retainedKey) throw new Error('请填入所选服务商的 API Key，再启用个人配置。');
    return {
      provider: draft.provider,
      base_url: draft.baseUrl.trim(),
      chat_model: draft.chatModel.trim(),
      vision_model: draft.visionModel.trim(),
      temperature,
      is_enabled: draft.enabled,
      ...(draft.apiKey.trim() ? { api_key: draft.apiKey.trim() } : {}),
    };
  };

  const perform = async (action: 'save' | 'test') => {
    if (locked.current || !draft || !saved) return;
    setError(null);
    setNotice(null);
    const testDefault = action === 'test' && !draft.enabled && !draft.apiKey.trim() && !saved.has_key;
    let patch: LLMSettingsUpdate = {};
    try { if (!testDefault) patch = buildUpdate(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请检查输入。');
      return;
    }
    locked.current = true;
    setPending(action);
    try {
      if (action === 'save') {
        const settings = await api.updateLLMSettings(patch);
        if (!mounted.current) return;
        setSaved(settings);
        setDraft(toDraft(settings));
        setNotice('模型配置已保存。');
      } else {
        const result = await api.testLLMSettings(testDefault ? undefined : patch);
        if (!mounted.current) return;
        if (!result.ok) throw new Error('连接未返回有效结果，请检查模型名称。');
        setNotice(`连接成功 · ${result.model}${testDefault ? '' : '。当前输入尚需保存才会生效。'}`);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试。');
    } finally {
      locked.current = false;
      if (mounted.current) setPending(null);
    }
  };

  const reset = () => {
    Alert.alert('恢复默认模型配置', '将删除已保存的个人配置和 API Key，之后使用服务端默认模型。', [
      { text: '取消', style: 'cancel' },
      { text: '恢复默认', style: 'destructive', onPress: () => { void (async () => {
        if (locked.current) return;
        locked.current = true;
        setPending('reset');
        setError(null);
        setNotice(null);
        try {
          await api.deleteLLMSettings();
          if (!mounted.current) return;
          // Do not leave the deleted secret's hint visible if the subsequent read fails.
          setSaved(null);
          setDraft(null);
          await load();
          if (mounted.current) setNotice('个人配置已删除。');
        } catch (cause) {
          if (mounted.current) setError(cause instanceof Error ? cause.message : '恢复默认失败，请重试。');
        } finally {
          locked.current = false;
          if (mounted.current) setPending(null);
        }
      })(); } },
    ]);
  };

  if (loading) return <View style={styles.card}><ActivityIndicator color={Colors.brand} /><Text style={styles.help}>正在加载模型配置…</Text></View>;
  if (!draft || !saved) return (
    <View style={styles.card}>
      <Text style={styles.error} accessibilityLiveRegion="polite">{error || '模型配置尚未加载。'}</Text>
      <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.secondaryButton}><Text style={styles.secondaryLabel}>重新加载</Text></Pressable>
    </View>
  );

  const disabled = pending !== null;
  const keepsKey = saved.has_key && saved.provider === draft.provider;
  const sourceLabel = saved.source === 'user' ? '个人配置' : saved.source === 'global' ? '服务端默认' : '尚未配置';
  return (
    <View style={styles.card}>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.heading}>使用个人模型</Text>
          <Text style={styles.help}>当前生效：{sourceLabel}</Text>
        </View>
        <Switch accessibilityLabel="启用个人模型配置" disabled={disabled} value={draft.enabled} onValueChange={enabled => update({ enabled })} trackColor={{ true: Colors.brand }} />
      </View>
      <Text style={styles.help}>支持兼容 OpenAI 的接口。连接测试通过后，保存即可用于 AI 对话与图片识别。</Text>
      <Text style={styles.label}>服务商</Text>
      <View style={styles.providerList}>
        {LLM_PROVIDER_PRESETS.map(preset => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: draft.provider === preset.value }} key={preset.value} disabled={disabled}
            onPress={() => selectProvider(preset.value)} style={[styles.providerButton, draft.provider === preset.value && styles.providerActive]}>
            <Text style={[styles.providerLabel, draft.provider === preset.value && styles.selectedLabel]}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Base URL</Text>
      <TextInput accessibilityLabel="模型接口 Base URL" editable={!disabled} style={styles.input} value={draft.baseUrl} onChangeText={baseUrl => update({ baseUrl })} placeholder="https://api.example.com/v1" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Text style={styles.label}>API Key</Text>
      <TextInput accessibilityLabel="模型 API Key" editable={!disabled} secureTextEntry style={styles.input} value={draft.apiKey} onChangeText={apiKey => update({ apiKey })} placeholder={keepsKey ? '留空保留已保存的 Key' : '输入所选服务商的 API Key'} placeholderTextColor={Colors.textTertiary} autoCapitalize="none" autoCorrect={false} autoComplete="off" />
      <Text style={styles.help}>{keepsKey ? `已保存：${saved.key_hint || '已设置'}。留空保留原 Key。` : '切换服务商后，请输入对应的 API Key。'} Key 加密保存。</Text>
      <Text style={styles.label}>对话模型</Text>
      <TextInput accessibilityLabel="对话模型" editable={!disabled} style={styles.input} value={draft.chatModel} onChangeText={chatModel => update({ chatModel })} placeholder="模型 ID" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" autoCorrect={false} />
      <Text style={styles.label}>图片模型（可选）</Text>
      <TextInput accessibilityLabel="图片识别模型" editable={!disabled} style={styles.input} value={draft.visionModel} onChangeText={visionModel => update({ visionModel })} placeholder="留空使用对话模型" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" autoCorrect={false} />
      <Text style={styles.label}>温度 · 0–2</Text>
      <TextInput accessibilityLabel="模型温度，0 到 2" editable={!disabled} style={styles.input} value={draft.temperature} onChangeText={temperature => update({ temperature })} keyboardType="decimal-pad" maxLength={5} />
      <Text style={styles.help}>数值越低，回答越稳定；越高，表达越多样。</Text>
      {!!saved.last_verified_at && <Text style={styles.help}>上次验证：{new Date(saved.last_verified_at).toLocaleString('zh-CN')}</Text>}
      {!!saved.last_error && !error && !notice && <Text style={styles.error}>上次连接失败：{saved.last_error}</Text>}
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={disabled} style={[styles.secondaryButton, styles.action, disabled && styles.disabled]} onPress={() => void perform('test')}>
          <Text style={styles.secondaryLabel}>{pending === 'test' ? '测试中…' : !draft.enabled && !saved.has_key && !draft.apiKey.trim() ? '测试默认连接' : '测试连接'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled} style={[styles.primaryButton, styles.action, disabled && styles.disabled]} onPress={() => void perform('save')}>
          <Text style={styles.primaryLabel}>{pending === 'save' ? '保存中…' : '保存模型配置'}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" disabled={disabled} style={[styles.resetButton, disabled && styles.disabled]} onPress={reset}><Text style={styles.resetLabel}>{pending === 'reset' ? '恢复中…' : '删除个人配置并恢复默认'}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, gap: 5 },
  heading: { fontSize: 16, fontWeight: '600', color: Colors.text },
  help: { fontSize: 12, lineHeight: 19, color: Colors.textSecondary },
  label: { fontSize: 13, color: Colors.textSecondary, marginTop: 12, fontWeight: '500' },
  input: { minHeight: 44, fontSize: 15, color: Colors.text, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  providerList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerButton: { paddingVertical: 12, paddingHorizontal: 12, minHeight: 44, backgroundColor: Colors.background, borderRadius: 10, justifyContent: 'center' },
  providerActive: { backgroundColor: Colors.brand },
  providerLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  selectedLabel: { color: '#fff' },
  error: { color: Colors.error, fontSize: 13, lineHeight: 20 },
  success: { color: Colors.success, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: Colors.background },
  secondaryLabel: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: Colors.brand },
  primaryLabel: { fontSize: 14, color: '#fff', fontWeight: '600' },
  resetButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  resetLabel: { fontSize: 13, color: Colors.error },
  disabled: { opacity: 0.45 },
});
