import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform,
} from 'react-native';
import {
  Settings, Character, saveSettings as persistSettings,
  getSettings, getCharacters, saveCharacters,
} from '../utils/storage';

interface Props {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>({ apiKey: '', apiUrl: '', model: '' });
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editChar, setEditChar] = useState<Character | null>(null);
  const [charName, setCharName] = useState('');
  const [charPrompt, setCharPrompt] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [s, chars] = await Promise.all([getSettings(), getCharacters()]);
    setSettings(s);
    setCharacters(chars);
  }

  async function save() {
    if (!settings.apiKey.trim()) {
      Alert.alert('提示', '请输入 API Key');
      return;
    }
    await persistSettings(settings);
    await saveCharacters(characters);
    Alert.alert('成功', '设置已保存');
    onClose();
  }

  function addOrUpdateChar() {
    if (!charName.trim()) { Alert.alert('提示', '请输入角色名称'); return; }
    const newChar: Character = {
      id: editChar?.id || Date.now().toString(),
      name: charName.trim(),
      systemPrompt: charPrompt.trim(),
    };
    const idx = characters.findIndex(c => c.id === newChar.id);
    if (idx >= 0) characters[idx] = newChar;
    else characters.push(newChar);
    setCharacters([...characters]);
    setEditChar(null);
    setCharName('');
    setCharPrompt('');
  }

  function deleteChar(id: string) {
    setCharacters(characters.filter(c => c.id !== id));
  }

  function startEdit(char: Character) {
    setEditChar(char);
    setCharName(char.name);
    setCharPrompt(char.systemPrompt);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>关闭</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>API 配置</Text>

        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={settings.apiKey}
          onChangeText={v => setSettings({ ...settings, apiKey: v })}
          placeholder="sk-..."
          placeholderTextColor="#999"
          secureTextEntry
        />

        <Text style={styles.label}>API 地址</Text>
        <TextInput
          style={styles.input}
          value={settings.apiUrl}
          onChangeText={v => setSettings({ ...settings, apiUrl: v })}
          placeholder="https://api.openai.com/v1"
          placeholderTextColor="#999"
          autoCapitalize="none"
        />

        <Text style={styles.label}>模型</Text>
        <TextInput
          style={styles.input}
          value={settings.model}
          onChangeText={v => setSettings({ ...settings, model: v })}
          placeholder="gpt-3.5-turbo"
          placeholderTextColor="#999"
          autoCapitalize="none"
        />

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>角色管理</Text>

        {characters.map(char => (
          <View key={char.id} style={styles.charItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.charName}>{char.name}</Text>
              <Text style={styles.charPrompt} numberOfLines={2}>{char.systemPrompt}</Text>
            </View>
            <TouchableOpacity onPress={() => startEdit(char)} style={styles.charBtn}>
              <Text style={styles.charBtnText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteChar(char.id)} style={styles.charBtn}>
              <Text style={[styles.charBtnText, { color: '#FF3B30' }]}>删除</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.editSection}>
          <Text style={styles.editTitle}>{editChar ? '编辑角色' : '添加角色'}</Text>
          <TextInput
            style={styles.input}
            value={charName}
            onChangeText={setCharName}
            placeholder="角色名称"
            placeholderTextColor="#999"
          />
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={charPrompt}
            onChangeText={setCharPrompt}
            placeholder="系统提示词 (System Prompt)"
            placeholderTextColor="#999"
            multiline
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.addBtn} onPress={addOrUpdateChar}>
              <Text style={styles.addBtnText}>{editChar ? '更新' : '添加'}</Text>
            </TouchableOpacity>
            {editChar && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setEditChar(null); setCharName(''); setCharPrompt('');
              }}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>保存设置</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  closeText: { fontSize: 16, color: '#007AFF' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#1A1A1A' },
  label: { fontSize: 14, fontWeight: '500', color: '#495057', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#F8F9FA',
    color: '#1A1A1A',
  },
  charItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  charName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  charPrompt: { fontSize: 12, color: '#6C757D', marginTop: 2 },
  charBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  charBtnText: { fontSize: 14, color: '#007AFF' },
  editSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
  },
  editTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8, color: '#1A1A1A' },
  editActions: { flexDirection: 'row', marginTop: 8, gap: 8 },
  addBtn: {
    backgroundColor: '#007AFF', borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    borderWidth: 1, borderColor: '#CED4DA', borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  cancelBtnText: { color: '#6C757D', fontSize: 15 },
  saveBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
