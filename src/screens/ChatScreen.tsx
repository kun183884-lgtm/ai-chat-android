import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import MessageBubble from '../components/MessageBubble';
import RoleSelector from '../components/RoleSelector';
import {
  Message, Character, Settings,
  getHistory, saveHistory, getSettings, getCharacters,
} from '../utils/storage';
import { streamChat } from '../services/api';

interface Props {
  onOpenSettings: () => void;
}

export default function ChatScreen({ onOpenSettings }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings>({ apiKey: '', apiUrl: '', model: '' });
  const [characters, setCharacters] = useState<Character[]>([]);
  const [currentChar, setCurrentChar] = useState<Character | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentChar) loadHistory(currentChar.id);
    else setMessages([]);
  }, [currentChar]);

  async function loadData() {
    const [s, chars] = await Promise.all([getSettings(), getCharacters()]);
    setSettings(s);
    setCharacters(chars);
    if (chars.length > 0 && !currentChar) {
      setCurrentChar(chars[0]);
    }
  }

  async function loadHistory(charId: string) {
    const history = await getHistory(charId);
    setMessages(history);
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!settings.apiKey) {
      Alert.alert('提示', '请先在设置中配置 API Key');
      return;
    }

    setInput('');
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const systemMsg: Message = currentChar ? {
      id: 'system-' + Date.now(),
      role: 'system',
      content: currentChar.systemPrompt,
      timestamp: Date.now(),
    } : null!;

    const updatedMessages = [...messages];
    if (systemMsg && !updatedMessages.some(m => m.role === 'system')) {
      updatedMessages.unshift(systemMsg);
    }
    updatedMessages.push(userMsg);
    setMessages(updatedMessages);
    setLoading(true);

    const assistantMsg: Message = {
      id: 'assistant-' + Date.now(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    updatedMessages.push(assistantMsg);
    setMessages([...updatedMessages]);

    abortRef.current = streamChat(
      updatedMessages.filter(m => m.content),
      settings.apiKey,
      settings.apiUrl,
      settings.model,
      {
        onToken: (token) => {
          assistantMsg.content += token;
          setMessages([...updatedMessages]);
        },
        onDone: () => {
          setLoading(false);
          if (currentChar) saveHistory(currentChar.id, updatedMessages);
        },
        onError: (err) => {
          setLoading(false);
          Alert.alert('错误', err.message);
        },
      },
    );
  }, [input, loading, settings, messages, currentChar]);

  function handleSelectChar(char: Character) {
    if (currentChar && currentChar.id !== char.id) {
      setCurrentChar(char);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Chat</Text>
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsText}>设置</Text>
        </TouchableOpacity>
      </View>

      <RoleSelector
        characters={characters}
        selectedId={currentChar?.id || null}
        onSelect={handleSelectChar}
        onManage={onOpenSettings}
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>开始和 AI 对话吧</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="输入消息..."
          placeholderTextColor="#999"
          multiline
          maxLength={4000}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}>
          <Text style={styles.sendText}>{loading ? '...' : '发送'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  settingsBtn: { padding: 4 },
  settingsText: { fontSize: 16, color: '#007AFF' },
  messageList: { flex: 1 },
  messageContent: { paddingVertical: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 16, color: '#999' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
