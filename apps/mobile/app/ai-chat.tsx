import { useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAIStream } from '@/hooks/useAIStream';
import { useCamera } from '@/hooks/useCamera';
import { Colors } from '@/constants/colors';
import type { ChatMessage } from '@lifolio/shared-types';

export default function AIChatScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const { messages, streaming, currentChunk, sendMessage } = useAIStream();
  const { captureAndAnalyze } = useCamera();
  const listRef = useRef<FlatList>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendMessage(text);
  };

  const handleCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await captureAndAnalyze('auto');
    if (result) {
      const summary = result.transactions?.length
        ? `识别到消费: ${result.transactions.map(t => `¥${t.amount} (${t.category ?? '其他'})`).join(', ')}`
        : result.items?.length
        ? `识别到物品: ${result.items.map(i => i.name).join(', ')}`
        : '未能识别，请重试';
      await sendMessage(`[图片识别结果] ${summary}`);
    }
  };

  const allMessages: (ChatMessage & { isStreaming?: boolean })[] = [
    ...messages,
    ...(streaming && currentChunk
      ? [{ role: 'assistant' as const, content: currentChunk, isStreaming: true }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.aiTag}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.aiLabel}>AI 助手</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>×</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={allMessages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptySparkle}>✦</Text>
            <Text style={styles.emptyText}>你好！我是 Lifolio AI。</Text>
            <Text style={styles.emptySubText}>说说今天的消费，或者问我任何问题。</Text>
          </View>
        }
        renderItem={({ item: msg }) => (
          <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI]}>
              {msg.content}
              {msg.isStreaming && <Text style={styles.cursor}>|</Text>}
            </Text>
          </View>
        )}
      />

      {/* Typing indicator */}
      {streaming && !currentChunk && (
        <View style={styles.typingRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.typingDot, { opacity: 0.4 + i * 0.2 }]} />
          ))}
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <Pressable onPress={handleCamera} style={styles.cameraBtn}>
            <Text style={styles.cameraBtnText}>📷</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="说说今天的消费..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={streaming || !input.trim()}
            style={[styles.sendBtn, (streaming || !input.trim()) && { opacity: 0.3 }]}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sparkle: { fontSize: 14, color: Colors.brand },
  aiLabel: { fontSize: 15, fontWeight: '600', color: '#fff' },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 24, color: 'rgba(255,255,255,0.5)', lineHeight: 28 },
  messageList: { padding: 16, gap: 12, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptySparkle: { fontSize: 40, color: Colors.brand, marginBottom: 12 },
  emptyText: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  emptySubText: { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 6 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.brand },
  bubbleAI: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAI: { color: '#fff' },
  cursor: { color: Colors.brand },
  typingRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingBottom: 8 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cameraBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  cameraBtnText: { fontSize: 18 },
  input: {
    flex: 1, color: '#fff', fontSize: 15, maxHeight: 100,
    paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { fontSize: 20, color: '#fff', fontWeight: '700', lineHeight: 24 },
});
