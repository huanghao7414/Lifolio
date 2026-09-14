import { useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAIStream } from '@/hooks/useAIStream';
import { useCamera } from '@/hooks/useCamera';
import { Colors } from '@/constants/colors';
import type { ChatMessage, Conversation } from '@lifolio/shared-types';

export default function AIChatScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [title, setTitle] = useState('');
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const chat = useAIStream();
  const { messages, conversation, streaming, loading, currentChunk, sendMessage } = chat;
  const { captureAndAnalyze } = useCamera();
  const listRef = useRef<FlatList>(null);
  const cameraRequest = useRef(false);
  const sendRequest = useRef(false);
  const busy = streaming || loading || cameraBusy;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy || sendRequest.current || cameraRequest.current) return;
    sendRequest.current = true;
    setInput('');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const sent = await sendMessage(text);
    if (!sent) setInput(current => current || text);
    sendRequest.current = false;
  };

  const handleCamera = async () => {
    if (busy || cameraRequest.current || sendRequest.current) return;
    cameraRequest.current = true;
    setCameraBusy(true);
    try {
      const result = await captureAndAnalyze('auto');
      if (result) {
        const summary = result.transactions?.length
          ? `识别到消费: ${result.transactions.map(t => `¥${t.amount} (${t.category ?? '其他'})`).join(', ')}`
          : result.items?.length
          ? `识别到物品: ${result.items.map(i => i.name).join(', ')}`
          : result.answer || '未能识别，请重试';
        const text = `[图片识别结果] ${summary}`;
        const sent = await sendMessage(text);
        if (!sent) setInput(current => current || text);
      }
    } catch (cause) {
      Alert.alert('图片识别失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      cameraRequest.current = false;
      setCameraBusy(false);
    }
  };

  const newChat = () => {
    chat.newConversation();
    setInput('');
    setHistoryVisible(false);
    setRenaming(null);
    setActionError(null);
  };

  const saveTitle = async () => {
    if (!renaming || !title.trim() || mutating) return;
    setMutating(true);
    setActionError(null);
    try {
      await chat.renameConversation(renaming.id, title);
      setRenaming(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '重命名失败，请重试。');
    } finally {
      setMutating(false);
    }
  };

  const confirmDelete = (item: Conversation) => {
    Alert.alert('删除对话', `确定删除「${item.title}」及其中的全部消息？此操作无法撤销。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        setMutating(true);
        setActionError(null);
        void chat.deleteConversation(item.id)
          .catch(cause => setActionError(cause instanceof Error ? cause.message : '删除失败，请重试。'))
          .finally(() => setMutating(false));
      } },
    ]);
  };

  const allMessages: (ChatMessage & { isStreaming?: boolean })[] = [
    ...messages,
    ...(streaming && currentChunk
      ? [{ role: 'assistant' as const, content: currentChunk, isStreaming: true }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.aiLabel} numberOfLines={1}>✦ {conversation?.title ?? 'Lifolio AI'}</Text>
          <Text style={styles.headerHint}> {conversation ? '对话历史自动保存' : '新对话 · 发送后自动保存'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="打开历史对话" disabled={busy} style={[styles.headerButton, busy && styles.disabled]}
          onPress={() => { setHistoryVisible(true); setActionError(null); void chat.refreshConversations(); }}>
          <Text style={styles.headerButtonText}>历史</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="新建对话" disabled={busy} style={[styles.headerButton, busy && styles.disabled]} onPress={newChat}>
          <Text style={styles.headerButtonText}>新建</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭 AI 助手" onPress={() => { chat.stop(); router.back(); }} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>×</Text>
        </Pressable>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={Colors.brandAccent} /><Text style={styles.statusText}>正在加载对话…</Text></View> : (
        <FlatList
          ref={listRef}
          data={allMessages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptySparkle}>✦</Text>
              <Text style={styles.emptyText}>你好！我是 Lifolio AI。</Text>
              <Text style={styles.emptySubText}>说说今天的消费，或者打开历史对话继续聊。</Text>
            </View>
          }
          renderItem={({ item: msg }) => (
            <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
              <Text selectable style={styles.bubbleText}>
                {msg.content}
                {msg.isStreaming && <Text style={styles.cursor}>|</Text>}
              </Text>
            </View>
          )}
        />
      )}

      {!!(chat.error || chat.warning) && (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeText}>{chat.error || chat.warning}</Text>
          {chat.error && conversation && !busy && (
            <Pressable accessibilityRole="button" style={styles.noticeAction} onPress={() => void chat.openConversation(conversation.id)}>
              <Text style={styles.headerButtonText}>重新加载对话</Text>
            </Pressable>
          )}
        </View>
      )}
      {(streaming && !currentChunk || cameraBusy) && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={Colors.brandAccent} />
          <Text style={styles.statusText}>{cameraBusy && !streaming ? '正在识别图片…' : '正在生成回答…'}</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="拍照识别" onPress={() => void handleCamera()} disabled={busy} style={[styles.cameraBtn, busy && styles.disabled]}>
            <Text style={styles.cameraBtnText}>📷</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="消息内容"
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="说说今天的消费..."
            placeholderTextColor={Colors.aiSub}
            onSubmitEditing={() => void handleSend()}
            returnKeyType="send"
            maxLength={20000}
            multiline
          />
          {streaming ? (
            <Pressable accessibilityRole="button" accessibilityLabel="停止生成" onPress={chat.stop} style={styles.sendBtn}>
              <Text style={styles.stopBtnText}>■</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="发送消息" onPress={() => void handleSend()}
              disabled={busy || !input.trim()} style={[styles.sendBtn, (busy || !input.trim()) && styles.disabled]}>
              <Text style={styles.sendBtnText}>↑</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={historyVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!mutating) setHistoryVisible(false); }}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.aiLabel, styles.heading]}>历史对话</Text>
            <Pressable accessibilityRole="button" style={styles.headerButton} disabled={mutating || loading} onPress={newChat}><Text style={styles.headerButtonText}>新建</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭历史对话" disabled={mutating} style={styles.closeBtn} onPress={() => setHistoryVisible(false)}><Text style={styles.closeBtnText}>×</Text></Pressable>
          </View>
          {renaming ? (
            <View style={styles.renameForm}>
              <Text style={styles.aiLabel}>重命名对话</Text>
              <TextInput accessibilityLabel="对话标题" autoFocus editable={!mutating} style={styles.titleInput} value={title} onChangeText={setTitle} maxLength={200} returnKeyType="done" onSubmitEditing={() => void saveTitle()} />
              <View style={styles.actionRow}>
                <Pressable accessibilityRole="button" disabled={mutating} style={styles.headerButton} onPress={() => { setRenaming(null); setActionError(null); }}><Text style={styles.headerButtonText}>取消</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={mutating || !title.trim()} style={[styles.primaryButton, (mutating || !title.trim()) && styles.disabled]} onPress={() => void saveTitle()}><Text style={styles.primaryButtonText}>{mutating ? '保存中…' : '保存标题'}</Text></Pressable>
              </View>
            </View>
          ) : null}
          {!!(actionError || chat.historyError || chat.error) && (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{actionError || chat.historyError || chat.error}</Text>
              {chat.historyError && <Pressable accessibilityRole="button" onPress={() => void chat.refreshConversations()} style={styles.noticeAction}><Text style={styles.headerButtonText}>重试</Text></Pressable>}
            </View>
          )}
          {loading && <ActivityIndicator color={Colors.brandAccent} style={styles.historySpinner} />}
          <FlatList
            data={chat.conversations}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.historyList}
            refreshing={chat.historyLoading}
            onRefresh={() => void chat.refreshConversations()}
            ListEmptyComponent={!chat.historyLoading ? <Text style={styles.emptySubText}>{chat.historyError ? '暂时无法加载历史对话。' : '还没有对话，开始聊聊吧。'}</Text> : null}
            ListFooterComponent={chat.hasMore ? (
              <Pressable accessibilityRole="button" disabled={chat.historyLoading} style={styles.headerButton} onPress={() => void chat.refreshConversations(true)}><Text style={styles.headerButtonText}>{chat.historyLoading ? '加载中…' : '加载更多'}</Text></Pressable>
            ) : null}
            renderItem={({ item }) => (
              <View style={[styles.historyCard, conversation?.id === item.id && styles.historyCardActive]}>
                <Pressable accessibilityRole="button" disabled={loading || mutating || !!renaming} style={styles.historyMain} onPress={async () => {
                  setActionError(null);
                  if (await chat.openConversation(item.id)) { setInput(''); setHistoryVisible(false); }
                }}>
                  <Text numberOfLines={2} style={styles.historyTitle}>{item.title || '新对话'}</Text>
                  <Text style={styles.historyMeta}>{item.message_count} 条消息 · {new Date(item.last_message_at || item.updated_at).toLocaleDateString('zh-CN')}</Text>
                </Pressable>
                <View style={styles.historyActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`重命名${item.title}`} disabled={mutating || loading} style={styles.historyAction} onPress={() => { setRenaming(item); setTitle(item.title); setActionError(null); }}><Text style={styles.headerButtonText}>重命名</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`删除${item.title}`} disabled={mutating || loading || !!renaming} style={styles.historyAction} onPress={() => confirmDelete(item)}><Text style={styles.deleteText}>删除</Text></Pressable>
                </View>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.aiCanvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.aiElevated, gap: 2 },
  heading: { flex: 1, minWidth: 0 },
  aiLabel: { fontSize: 15, fontWeight: '600', color: Colors.aiText },
  headerHint: { fontSize: 11, color: Colors.aiSub, marginTop: 5 },
  headerButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  headerButtonText: { fontSize: 13, color: Colors.aiText, fontWeight: '500' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 24, color: Colors.aiSub, lineHeight: 28 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  statusText: { fontSize: 12, color: Colors.aiSub },
  messageList: { padding: 16, gap: 12, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptySparkle: { fontSize: 40, color: Colors.brandAccent, marginBottom: 12 },
  emptyText: { fontSize: 16, color: Colors.aiSub, fontWeight: '500' },
  emptySubText: { fontSize: 14, lineHeight: 22, color: Colors.aiSub, marginTop: 6, textAlign: 'center' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.aiElevated },
  bubbleAI: { alignSelf: 'flex-start', backgroundColor: Colors.aiSurface },
  bubbleText: { fontSize: 15, lineHeight: 22, color: Colors.aiText },
  cursor: { color: Colors.brandAccent },
  notice: { backgroundColor: Colors.aiElevated, margin: 12, borderRadius: 12, padding: 12 },
  noticeText: { color: Colors.aiText, fontSize: 13, lineHeight: 20 },
  noticeAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.aiSurface, borderTopWidth: 1, borderTopColor: Colors.aiElevated },
  cameraBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.aiElevated, alignItems: 'center', justifyContent: 'center' },
  cameraBtnText: { fontSize: 18 },
  input: { flex: 1, color: Colors.aiText, fontSize: 15, maxHeight: 100, minHeight: 44, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.aiCanvas, borderRadius: 22 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { fontSize: 20, color: '#fff', fontWeight: '700', lineHeight: 24 },
  stopBtnText: { fontSize: 14, color: '#fff' },
  disabled: { opacity: 0.4 },
  renameForm: { padding: 20, gap: 12, backgroundColor: Colors.aiSurface },
  titleInput: { color: Colors.aiText, borderWidth: 1, borderColor: Colors.aiElevated, borderRadius: 12, padding: 12, minHeight: 44, fontSize: 16 },
  actionRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  primaryButton: { minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: Colors.brand, justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  historyList: { padding: 16, gap: 12, flexGrow: 1 },
  historyCard: { borderRadius: 16, backgroundColor: Colors.aiSurface, borderWidth: 1, borderColor: Colors.aiElevated },
  historyCardActive: { borderColor: Colors.brandAccent },
  historyMain: { padding: 16, minHeight: 64, gap: 8 },
  historyTitle: { fontSize: 16, color: Colors.aiText, fontWeight: '600' },
  historyMeta: { fontSize: 12, color: Colors.aiSub },
  historyActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: Colors.aiElevated },
  historyAction: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  deleteText: { fontSize: 13, color: Colors.aiText },
  historySpinner: { marginTop: 12 },
});
