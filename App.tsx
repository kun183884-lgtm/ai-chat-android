import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Alert, StatusBar, Switch, KeyboardAvoidingView, Platform, Share, Linking, BackHandler, ToastAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { pick } from '@react-native-documents/picker';

const PROVIDERS = [
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', registerUrl: 'https://platform.deepseek.com/signup' },
  { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', registerUrl: 'https://cloud.siliconflow.cn' },
  { name: '智谱AI', url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', registerUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { name: '阿里云', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', registerUrl: 'https://www.aliyun.com/product/bailian' },
  { name: '自定义', url: '', model: '' },
];

const defaultRoles = [
  { id: '1', name: '通用助手', avatar: '🤖', prompt: '你是一个有用的AI助手。', catchphrase: '', opening: '', model: '', temperature: 70 },
  { id: '2', name: '编程专家', avatar: '👨‍💻', prompt: '你是一个资深程序员，用中文回答技术问题。', catchphrase: '', opening: '', model: '', temperature: 50 },
  { id: '3', name: '翻译官', avatar: '🌐', prompt: '你是一个翻译官，帮我把任何语言翻译成中文。', catchphrase: '', opening: '', model: '', temperature: 30 },
];

const TEMP_LABELS = ['极精确', '很精确', '较精确', '微偏低', '适中', '微偏高', '偏高', '很创意', '极创意'];

const stripHtml = (text) => text.replace(/<[^>]*>/g, '');
const APP_VERSION_CODE = 16;
const APP_VERSION_NAME = '2.14';
const UPDATE_URL = 'https://raw.githubusercontent.com/kun183884-lgtm/ai-chat-android/main/latest.json';

export default function App() {
  const [config, setConfig] = useState({ apiKey: '', baseUrl: '', model: '', bgColor: '#ffffff', showThinking: true, showThinkingTime: true, workDir: '' });
  const [roles, setRoles] = useState(defaultRoles);
  const [currentRoleId, setCurrentRoleId] = useState('1');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editCatchphrase, setEditCatchphrase] = useState('');
  const [editOpening, setEditOpening] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editTemp, setEditTemp] = useState(70);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [showModelList, setShowModelList] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');
  const [showThinkingBox, setShowThinkingBox] = useState(false);
  const [showProviderList, setShowProviderList] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const loadedMsg = useRef(false);
  const abortRef = useRef(null);
  const prevRole = useRef(currentRoleId);
  const startTimeRef = useRef(0);

  useEffect(() => { AsyncStorage.getItem('config').then(v => { if (v) try { const p = JSON.parse(v); setConfig(prev => ({ ...prev, ...p })); } catch {} setReady(true); }); }, []);
  useEffect(() => { AsyncStorage.getItem('roles').then(v => { if (v) try { setRoles(JSON.parse(v)); } catch {} }); }, []);

  useEffect(() => {
    AsyncStorage.getItem('msg_' + currentRoleId).then(v => {
      if (v) { try { setMessages(JSON.parse(v)); } catch {} } else { setMessages([]); }
      loadedMsg.current = true;
    });
  }, [currentRoleId]);

  useEffect(() => {
    if (prevRole.current !== currentRoleId) {
      AsyncStorage.setItem('msg_' + prevRole.current, JSON.stringify(messages));
      prevRole.current = currentRoleId;
    }
  }, [currentRoleId]);

  useEffect(() => {
    if (loadedMsg.current) AsyncStorage.setItem('msg_' + currentRoleId, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      if (startTimeRef.current) setElapsed(Math.round((Date.now() - startTimeRef.current) / 100) / 10);
    }, 100);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    let exitCount = 0;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editRole) { setEditRole(null); return true; }
      if (showSettings) { setShowSettings(false); return true; }
      if (exitCount === 0) {
        exitCount++;
        ToastAndroid.show('再按一次退出应用', ToastAndroid.SHORT);
        setTimeout(() => exitCount = 0, 2000);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [editRole, showSettings]);

  useEffect(() => { AsyncStorage.setItem('config', JSON.stringify(config)); }, [config]);
  useEffect(() => { AsyncStorage.setItem('roles', JSON.stringify(roles)); }, [roles]);

  const currentRole = roles.find(r => r.id === currentRoleId) || roles[0];

  function buildMessages(msgList) {
    let prompt = currentRole.prompt;
    if (currentRole.catchphrase) prompt += '\n\n你的口头禅是：' + currentRole.catchphrase;
    if (currentRole.opening) prompt += '\n\n每次对话的开场白是：' + currentRole.opening;
    if (config.workDir) prompt += '\n\n你可以使用以下标签操作本地文件（工作目录：' + config.workDir + '，路径使用相对于此目录的相对路径）：\n<file_read>相对路径</file_read> — 读取文件内容\n<file_write>相对路径</file_write>文件内容<file_write_end> — 写入/覆盖文件\n<file_list>相对路径</file_list> — 列出目录内容（不填则列根）\n标签必须单独成行使用。';
    prompt += '\n\n你也可以使用以下标签调用手机功能（标签必须单独成行）：\n<set_alarm hour="7" minute="0" label="起床" /> — 设置闹钟\n<make_call number="13800138000" /> — 打开拨号界面\n<send_sms number="13800138000" text="你好" /> — 打开短信界面\n<open_app pkg="com.android.vending" /> — 打开应用';
    return [{ role: 'system', content: prompt }, ...msgList.slice(0, -1).map(m => ({ role: m.role, content: m.content }))];
  }

  async function processFileOps(content) {
    if (!config.workDir) return content;
    const workDir = config.workDir.replace(/\\/g, '/').replace(/\/+$/, '');
    let result = content;

    const matchDir = (p) => {
      const target = workDir + '/' + p.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!target.startsWith(workDir)) throw new Error('路径超出工作目录');
      return target;
    };

    // <file_list>
    const listRe = /<file_list>([^<]*)<\/file_list>/g;
    let m;
    while ((m = listRe.exec(result)) !== null) {
      try {
        const path = m[1].trim();
        const target = path ? matchDir(path) : workDir;
        const list = await ReactNativeBlobUtil.fs.ls(target);
        result = result.replace(m[0], '📁 ' + (path || '/') + ' 下的文件：\n' + list.join('\n'));
      } catch (e) { result = result.replace(m[0], '❌ 列表失败: ' + e.message); }
    }

    // <file_read>
    const readRe = /<file_read>([^<]*)<\/file_read>/g;
    while ((m = readRe.exec(result)) !== null) {
      try {
        const path = m[1].trim();
        const target = matchDir(path);
        const data = await ReactNativeBlobUtil.fs.readFile(target, 'utf8');
        result = result.replace(m[0], '📄 ' + path + ' 内容：\n```\n' + data + '\n```');
      } catch (e) { result = result.replace(m[0], '❌ 读取失败: ' + e.message); }
    }

    // <file_write>content<file_write_end>
    const writeRe = /<file_write>([^<]*)<\/file_write>([\s\S]*?)<file_write_end>/g;
    while ((m = writeRe.exec(result)) !== null) {
      try {
        const path = m[1].trim();
        const target = matchDir(path);
        await ReactNativeBlobUtil.fs.writeFile(target, m[2].trim(), 'utf8');
        result = result.replace(m[0], '✅ 已写入 ' + path);
      } catch (e) { result = result.replace(m[0], '❌ 写入失败: ' + e.message); }
    }

    return result;
  }

  async function processPhoneActions(content) {
    let result = content;
    const actions = [];
    const re = /<(set_alarm|make_call|send_sms|open_app)\s+([^/>]*)\/>/g;
    let m;
    while ((m = re.exec(result)) !== null) {
      const tag = m[1];
      const attrs = {};
      m[2].replace(/(\w+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; });
      actions.push({ tag, attrs });
    }
    if (actions.length === 0) return result;
    for (const act of actions) {
      try {
        let url = '';
        let label = '';
        if (act.tag === 'set_alarm') {
          url = 'intent:#Intent;action=android.intent.action.SET_ALARM;S.android.intent.extra.alarm.HOUR=' + act.attrs.hour + ';S.android.intent.extra.alarm.MINUTES=' + act.attrs.minute + ';S.android.intent.extra.alarm.MESSAGE=' + encodeURIComponent(act.attrs.label || '闹钟') + ';end';
          label = '设置闹钟';
        } else if (act.tag === 'make_call') {
          url = 'tel:' + act.attrs.number;
          label = '拨号';
        } else if (act.tag === 'send_sms') {
          url = 'sms:' + act.attrs.number + '?body=' + encodeURIComponent(act.attrs.text || '');
          label = '发送短信';
        } else if (act.tag === 'open_app') {
          url = 'intent:#Intent;action=android.intent.action.MAIN;package=' + act.attrs.pkg + ';end';
          label = '打开应用';
        }
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
        else label += '（不支持）';
        result = result.replace(m[0], '✅ 已' + label);
      } catch (e) { result = result.replace(m[0], '❌ ' + label + '失败: ' + e.message); }
    }
    return result;
  }

  function stopGeneration() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    if (!config.apiKey) { Alert.alert('提示', '请先在设置中配置 API Key'); setShowSettings(true); return; }
    setInput('');
    const userMsg = { role: 'user', content: text };
    const assistantMsg = { role: 'assistant', content: '', reasoning: '' };
    const updated = [...messages, userMsg, assistantMsg];
    setMessages(updated);
    setLoading(true);
    setThinkingContent('');
    setShowThinkingBox(false);
    startTimeRef.current = Date.now();
    setElapsed(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const useModel = currentRole.model || config.model;
      const temp = (currentRole.temperature || 70) / 100;
      const res = await fetch(config.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
        body: JSON.stringify({ model: useModel, messages: buildMessages(updated), stream: true, temperature: temp }),
        signal: controller.signal,
      });
      if (!res.ok) {
        let errMsg = 'HTTP ' + res.status;
        try { const e = await res.json(); errMsg = e.error?.message || e.message || JSON.stringify(e); } catch { try { errMsg = await res.text(); } catch {} }
        setMessages(prev => { const next = [...prev]; next[next.length - 1] = { role: 'error', content: errMsg }; return next; });
        setLoading(false); return;
      }

      let fullContent = '', fullReasoning = '';

      function updateStream(content, reasoning) {
        if (abortRef.current === null) return;
        if (content) fullContent += content;
        if (reasoning) fullReasoning += reasoning;
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 100) / 10);
        setThinkingContent(fullReasoning);
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: fullContent, reasoning: fullReasoning };
          return next;
        });
      }

      function parseSSE(data) {
        const lines = data.split('\n');
        for (const line of lines) {
          const t = line.trim();
          if (!t || !t.startsWith('data: ')) continue;
          const d = t.slice(6).trim();
          if (d === '[DONE]') return true;
          try {
            const json = JSON.parse(d);
            const delta = json.choices?.[0]?.delta || {};
            if (delta.content || delta.reasoning_content) {
              updateStream(delta.content || '', delta.reasoning_content || '');
            }
          } catch {}
        }
        return false;
      }

      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          if (abortRef.current === null) break;
          const { done, value } = await reader.read();
          if (done) break;
          if (abortRef.current === null) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          if (parseSSE(lines.join('\n'))) break;
        }
      } else {
        const text = await res.text();
        parseSSE(text);
      }
      if (fullContent) {
        const processed = await processFileOps(fullContent);
        const processed2 = await processPhoneActions(processed);
        if (processed2 !== fullContent) {
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: processed2, reasoning: fullReasoning };
            return next;
          });
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content || '(已停止)' };
          }
          return next;
        });
      } else {
        Alert.alert('网络错误', e.message);
        setMessages(updated.slice(0, -1));
      }
    }
    abortRef.current = null;
    setLoading(false);
  }

  function clearMessages() {
    if (messages.length === 0) return;
    Alert.alert('确认', '清空当前对话？', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => setMessages([]) },
    ]);
  }

  async function fetchModels() {
    if (!config.baseUrl || !config.apiKey) { Alert.alert('提示', '请先填写 API 地址和 Key'); return; }
    setLoadingModels(true);
    try {
      const url = config.baseUrl.replace(/\/+$/, '') + '/models';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + config.apiKey } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setModels((data.data || []).filter(m => m.id).map(m => m.id));
      setShowModelList(true);
    } catch (e) { Alert.alert('错误', '获取模型列表失败: ' + e.message); }
    setLoadingModels(false);
  }

  async function exportRoles() {
    try {
      const data = JSON.stringify(roles, null, 2);
      const filePath = ReactNativeBlobUtil.fs.dirs.DownloadDir + '/AI聊天角色配置.json';
      await ReactNativeBlobUtil.fs.writeFile(filePath, data, 'utf8');
      Alert.alert('导出成功', '已保存到: ' + filePath, [
        { text: '好的' },
        { text: '分享', onPress: async () => {
          try {
            const uri = Platform.OS === 'android' ? 'content://' + filePath : filePath;
            await Share.share({ url: uri, title: 'AI Chat 角色配置' });
          } catch {}
        }},
      ]);
    } catch (e) { Alert.alert('导出失败', e.message); }
  }

  async function importRoles() {
    try {
      const result = await pick({ type: ['application/json'], allowMultiSelection: false });
      if (!result || result.length === 0) return;
      const uri = decodeURIComponent(result[0].uri);
      const content = await ReactNativeBlobUtil.fs.readFile(uri, 'utf8');
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const valid = arr.filter(function(r) { return r.name || r.prompt; });
      if (valid.length === 0) { Alert.alert('错误', '未找到有效角色数据'); return; }
      const imported = valid.map(function(r, i) { return { id: (Date.now() + i).toString(), name: r.name || '未命名', avatar: r.avatar || '🤖', prompt: r.prompt || '', catchphrase: r.catchphrase || '', opening: r.opening || '', model: r.model || '', temperature: r.temperature !== undefined && r.temperature !== null ? r.temperature : 70 }; });
      setRoles(function(prev) { return prev.concat(imported); });
      Alert.alert('成功', '导入了 ' + valid.length + ' 个角色');
    } catch (e) { Alert.alert('导入失败', e.message); }
  }

  async function checkForUpdate() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(UPDATE_URL + '?t=' + Date.now(), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) { Alert.alert('检查失败', '无法连接更新服务器 (HTTP ' + res.status + ')'); return; }
      const data = await res.json();
      if (data.versionCode > APP_VERSION_CODE) {
        Alert.alert('发现新版本 ' + data.versionName, data.note + '\n\n是否下载更新？', [
          { text: '稍后', style: 'cancel' },
          { text: '下载', onPress: () => downloadUpdate(data.url) },
        ]);
      } else {
        Alert.alert('已是最新版本', '当前版本 v' + APP_VERSION_NAME);
      }
    } catch (e) { Alert.alert('检查失败', '网络超时或无法连接服务器'); }
    setCheckingUpdate(false);
  }

  async function downloadUpdate(url) {
    try {
      const dest = ReactNativeBlobUtil.fs.dirs.DownloadDir + '/AIChat-' + Date.now() + '.apk';
      const res = await ReactNativeBlobUtil.config({ path: dest, fileCache: true }).fetch('GET', url);
      await ReactNativeBlobUtil.android.actionViewIntent(res.path(), 'application/vnd.android.package-archive');
    } catch (e) { Alert.alert('下载失败', e.message); }
  }

  if (!ready) return null;

  let content;
  if (editRole) {
    content = (
      <View style={{ flex: 1, paddingTop: 50, padding: 20 }}>
        <StatusBar barStyle="dark-content" />
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>编辑角色</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={{ marginBottom: 4 }}>名称</Text>
          <TextInput style={s.input} value={editName} onChangeText={setEditName} />
          <Text style={{ marginBottom: 4 }}>头像（Emoji）</Text>
          <TextInput style={s.input} value={editAvatar} onChangeText={setEditAvatar} placeholder="🤖" />
          <Text style={{ marginBottom: 4 }}>系统提示词</Text>
          <TextInput style={[s.input, { height: 80 }]} value={editPrompt} onChangeText={setEditPrompt} multiline />
          <Text style={{ marginBottom: 4 }}>口头禅（可选）</Text>
          <TextInput style={s.input} value={editCatchphrase} onChangeText={setEditCatchphrase} placeholder="原来如此..." />
          <Text style={{ marginBottom: 4 }}>开场白（可选）</Text>
          <TextInput style={s.input} value={editOpening} onChangeText={setEditOpening} placeholder="你好，我是..." />
          <Text style={{ marginBottom: 4 }}>模型（留空使用全局）</Text>
          <TextInput style={s.input} value={editModel} onChangeText={setEditModel} placeholder={config.model} />
          <Text style={{ marginBottom: 4 }}>思考程度: {TEMP_LABELS[Math.min(Math.round(editTemp / 10), 8)] || '适中'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12, color: '#999' }}>精确</Text>
            <View style={{ flex: 1, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2 }}>
              <View style={{ width: editTemp + '%', height: 4, backgroundColor: '#e94560', borderRadius: 2 }} />
            </View>
            <Text style={{ fontSize: 12, color: '#999' }}>创意</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
              <TouchableOpacity key={v} onPress={() => setEditTemp(v)}
                style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: editTemp === v ? '#e94560' : '#eee', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 24 }}>
            <TouchableOpacity onPress={() => setEditRole(null)} style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, marginRight: 8, alignItems: 'center' }}>
              <Text>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              if (!editName.trim()) { Alert.alert('提示', '请输入名称'); return; }
              setRoles(prev => prev.map(r => r.id === editRole.id ? { ...r, name: editName.trim(), avatar: editAvatar.trim() || '🤖', prompt: editPrompt.trim(), catchphrase: editCatchphrase.trim(), opening: editOpening.trim(), model: editModel.trim(), temperature: editTemp } : r));
              setEditRole(null);
            }} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#e94560', alignItems: 'center' }}>
              <Text style={{ color: '#FFF' }}>保存</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => {
            if (roles.length <= 1) { Alert.alert('提示', '至少保留一个角色'); return; }
            Alert.alert('确认', '删除角色「' + editRole.name + '」？', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => {
                const idx = roles.findIndex(r => r.id === editRole.id);
                setRoles(prev => prev.filter(r => r.id !== editRole.id));
                if (currentRoleId === editRole.id) setCurrentRoleId(roles.find((r, i) => i !== idx)?.id || roles[0]?.id || '1');
                setEditRole(null);
              }},
            ]);
          }} style={{ padding: 12, marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: '#e94560' }}>删除此角色</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  } else if (showSettings) {
    content = (
      <View style={{ flex: 1, paddingTop: 50, backgroundColor: '#fff' }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
          <TouchableOpacity onPress={() => setShowSettings(false)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#e94560', fontSize: 15 }}>← 返回</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', marginRight: 50 }}>设置</Text>
        </View>
        <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={{ fontSize: 14, color: '#e94560', fontWeight: '600', marginBottom: 10 }}>选择供应商</Text>
          <TouchableOpacity onPress={() => { setProviderSearch(''); setShowProviderList(true); }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5', marginBottom: 16 }}>
            <Text style={{ fontSize: 14, color: '#333' }}>{PROVIDERS.find(p => p.url === config.baseUrl)?.name || '自定义'}</Text>
            <Text style={{ color: '#e94560', fontSize: 12 }}>切换 ▾</Text>
          </TouchableOpacity>
          {showProviderList && (
            <View style={{ maxHeight: 250, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 16, marginTop: -8 }}>
              <TextInput style={{ padding: 8, borderBottomWidth: 1, borderColor: '#eee', fontSize: 13 }} placeholder="搜索供应商..." value={providerSearch} onChangeText={setProviderSearch} />
              <ScrollView nestedScrollEnabled>
                {PROVIDERS.filter(p => !providerSearch || p.name.includes(providerSearch) || p.url.includes(providerSearch)).map(p => (
                  <TouchableOpacity key={p.name} onPress={() => { setConfig({ ...config, baseUrl: p.url, model: p.model }); setShowProviderList(false); }}
                    style={{ padding: 12, borderBottomWidth: 1, borderColor: '#f5f5f5', backgroundColor: config.baseUrl === p.url ? '#fff0f0' : '#fff' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{p.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {p.registerUrl && (
                          <TouchableOpacity onPress={() => Linking.openURL(p.registerUrl)} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#e94560' }}>
                            <Text style={{ fontSize: 11, color: '#e94560' }}>注册</Text>
                          </TouchableOpacity>
                        )}
                        {p.url && <Text style={{ fontSize: 11, color: '#999' }}>{p.url.replace('https://', '')}</Text>}
                      </View>
                    </View>
                    {p.model && <Text style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>默认模型: {p.model}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <Text style={{ marginBottom: 4 }}>API 地址</Text>
          <TextInput style={s.input} value={config.baseUrl} onChangeText={v => setConfig({ ...config, baseUrl: v })} />
          <Text style={{ marginBottom: 4 }}>API Key</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[s.input, { flex: 1 }]} value={config.apiKey} onChangeText={v => setConfig({ ...config, apiKey: v })} placeholder="sk-..." secureTextEntry={!showKey} />
            <TouchableOpacity onPress={() => setShowKey(!showKey)} style={{ padding: 12, backgroundColor: '#eee', borderRadius: 8 }}>
              <Text style={{ color: '#e94560' }}>{showKey ? '隐藏' : '显示'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ marginBottom: 4, marginTop: 16 }}>模型</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[s.input, { flex: 1 }]} value={config.model} onChangeText={v => setConfig({ ...config, model: v })} placeholder="gpt-3.5-turbo" />
            <TouchableOpacity onPress={fetchModels} disabled={loadingModels} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e94560', justifyContent: 'center' }}>
              <Text style={{ color: '#e94560', fontWeight: '600' }}>{loadingModels ? '...' : '获取'}</Text>
            </TouchableOpacity>
          </View>
          {showModelList && models.length > 0 && (
            <View style={{ maxHeight: 200, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginTop: 8 }}>
              <TextInput style={{ padding: 8, borderBottomWidth: 1, borderColor: '#eee', fontSize: 13 }} placeholder="搜索模型..." onChangeText={t => {
                setModels(prev => prev.filter(m => m.toLowerCase().includes(t.toLowerCase())));
              }} />
              <ScrollView nestedScrollEnabled>
                {models.map(m => (
                  <TouchableOpacity key={m} onPress={() => { setConfig({ ...config, model: m }); setShowModelList(false); }}
                    style={{ padding: 10, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                    <Text style={{ fontSize: 13 }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 16 }} />
          <Text style={{ marginBottom: 4 }}>工作目录（让 AI 读写文件）</Text>
          <TextInput style={s.input} value={config.workDir} onChangeText={v => setConfig({ ...config, workDir: v })} placeholder="例如: /storage/emulated/0" />
          <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 16 }} />
          <Text style={{ marginBottom: 4 }}>聊天背景</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ width: 42, height: 42, borderRadius: 8, borderWidth: 2, borderColor: '#e0e0e0', backgroundColor: config.bgColor }} />
            <TextInput style={[s.input, { flex: 1 }]} value={config.bgColor} onChangeText={v => setConfig({ ...config, bgColor: v })} placeholder="#ffffff" />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {['#ffffff', '#f0f4ff', '#fff5f5', '#f5fff0', '#fffbe6', '#f3e5f5', '#e0f7fa', '#1a1a2e'].map(c => (
              <TouchableOpacity key={c} onPress={() => setConfig({ ...config, bgColor: c })}
                style={{ width: 32, height: 32, borderRadius: 16, borderWidth: config.bgColor === c ? 3 : 1, borderColor: config.bgColor === c ? '#e94560' : '#ddd', backgroundColor: c }} />
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 16 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text>显示思考过程</Text>
            <Switch value={config.showThinking} onValueChange={v => setConfig({ ...config, showThinking: v })} trackColor={{ false: '#ddd', true: '#e94560' }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text>显示响应时间</Text>
            <Switch value={config.showThinkingTime} onValueChange={v => setConfig({ ...config, showThinkingTime: v })} trackColor={{ false: '#ddd', true: '#e94560' }} />
          </View>
          <TouchableOpacity onPress={checkForUpdate} disabled={checkingUpdate}
            style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e94560', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#e94560', fontWeight: '600' }}>{checkingUpdate ? '检查中...' : '🔄 检查更新 (v' + APP_VERSION_NAME + ')'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { if (!config.apiKey.trim()) { Alert.alert('提示', '请输入 API Key'); return; } setShowSettings(false); }}
            style={{ backgroundColor: '#e94560', padding: 14, borderRadius: 10, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>保存设置</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  } else {
    const sidebar = (
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 280, backgroundColor: '#fff', zIndex: 100, elevation: 10, paddingTop: 50, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontSize: 17, fontWeight: '600' }}>选择角色</Text>
          <TouchableOpacity onPress={() => setShowRoles(false)}><Text style={{ color: '#e94560', fontSize: 18 }}>✕</Text></TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => {
          const newRole = { id: Date.now().toString(), name: '新角色', avatar: '🧑', prompt: '你是一个有用的AI助手。', catchphrase: '', opening: '', model: '', temperature: 70 };
          setRoles(prev => [...prev, newRole]);
          setEditRole(newRole);
          setEditName('新角色'); setEditAvatar('🧑'); setEditPrompt('你是一个有用的AI助手。');
          setEditCatchphrase(''); setEditOpening(''); setEditModel(''); setEditTemp(70);
        }} style={{ margin: 12, backgroundColor: '#e94560', padding: 12, borderRadius: 10, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>＋ 新建角色</Text>
        </TouchableOpacity>
        <FlatList
          data={roles}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => { setCurrentRoleId(item.id); setShowRoles(false); }}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginHorizontal: 8, borderRadius: 8, marginBottom: 2, backgroundColor: item.id === currentRoleId ? '#fff0f0' : 'transparent' }}>
              <Text style={{ fontSize: 18, marginRight: 10 }}>{item.avatar || '🤖'}</Text>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: item.id === currentRoleId ? '600' : '400' }}>{item.name}</Text>
              <TouchableOpacity onPress={() => {
                setEditRole(item);
                setEditName(item.name); setEditAvatar(item.avatar || '🤖'); setEditPrompt(item.prompt);
                setEditCatchphrase(item.catchphrase || ''); setEditOpening(item.opening || '');
                setEditModel(item.model || ''); setEditTemp(item.temperature || 70);
              }}><Text style={{ color: '#999', padding: 4 }}>⚙️</Text></TouchableOpacity>
            </TouchableOpacity>
          )}
        />
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#eee', padding: 12 }}>
          <TouchableOpacity onPress={exportRoles} style={{ flex: 1, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#e94560', fontWeight: '600' }}>📤 导出角色</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={importRoles} style={{ flex: 1, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#e94560', fontWeight: '600' }}>📥 导入角色</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

    content = (
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, paddingTop: 50, backgroundColor: config.bgColor }}>
          <StatusBar barStyle="dark-content" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity onPress={() => setShowRoles(true)} style={{ padding: 6, backgroundColor: '#f0f0f0', borderRadius: 8 }}><Text style={{ fontSize: 20 }}>☰</Text></TouchableOpacity>
            <Text style={{ fontSize: 22 }}>{currentRole?.avatar || '🤖'}</Text>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>{currentRole?.name || 'AI Chat'}</Text>
              <Text style={{ fontSize: 11, color: loading ? '#e94560' : '#999' }}>{loading ? '思考中... ' + elapsed + 's' : '空闲'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={clearMessages}><Text style={{ color: '#e94560', padding: 4 }}>清空</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettings(true)}><Text style={{ color: '#e94560', padding: 4 }}>设置</Text></TouchableOpacity>
          </View>
        </View>
        <FlatList
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => (
            <View style={{ marginBottom: 10, alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {item.role === 'assistant' && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text style={{ fontSize: 28 }}>{currentRole?.avatar || '🤖'}</Text>
                  <View>
                    <Text style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>
                      {currentRole?.name || 'AI'}{config.showThinkingTime && elapsed > 0 && index === messages.length - 1 ? ' · ' + elapsed + 's' : ''}
                    </Text>
                    {config.showThinking && item.reasoning && (
                      <View style={{ backgroundColor: '#f8f9fa', borderLeftWidth: 3, borderLeftColor: '#e94560', borderRadius: 8, marginBottom: 6 }}>
                        <TouchableOpacity onPress={() => setShowThinkingBox(!showThinkingBox)} style={{ padding: 8 }}>
                          <Text style={{ fontSize: 12, color: '#e94560', fontWeight: '500' }}>💭 已思考</Text>
                        </TouchableOpacity>
                        {showThinkingBox && (
                          <Text style={{ padding: 8, paddingTop: 0, fontSize: 13, color: '#666', lineHeight: 18 }}>{item.reasoning}</Text>
                        )}
                      </View>
                    )}
                    <View style={{ backgroundColor: '#f0f0f0', borderRadius: 14, borderBottomLeftRadius: 4, padding: 10, maxWidth: 280 }}>
                      <Text style={{ fontSize: 15, lineHeight: 22, color: '#333' }}>{item.content || (item.reasoning && !item.content ? '...' : '')}</Text>
                    </View>
                  </View>
                </View>
              )}
              {item.role === 'user' && (
                <View style={{ backgroundColor: '#e94560', borderRadius: 14, borderBottomRightRadius: 4, padding: 10, maxWidth: 280 }}>
                  <Text style={{ fontSize: 15, lineHeight: 22, color: '#fff' }}>{item.content}</Text>
                </View>
              )}
              {item.role === 'error' && (
                <View style={{ backgroundColor: '#ffe0e0', borderRadius: 14, padding: 10, maxWidth: 280 }}>
                  <Text style={{ fontSize: 15, color: '#c0392b' }}>{item.content}</Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#bbb' }}>开始对话吧</Text></View>}
        />
        <View style={{ flexDirection: 'row', padding: 8, gap: 8, backgroundColor: '#fafafa', borderTopWidth: 1, borderColor: '#eee' }}>
          <TextInput
            style={{ flex: 1, borderWidth: 1.5, borderColor: '#e4e4e4', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, fontSize: 15, maxHeight: 100, backgroundColor: '#fff' }}
            value={input}
            onChangeText={setInput}
            placeholder={loading ? 'AI 正在生成...' : '输入消息...'}
            multiline
            editable={!loading}
          />
          {loading ? (
            <TouchableOpacity onPress={stopGeneration}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#666', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>■</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={sendMessage}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          )}
        </View>
        </View>
        </KeyboardAvoidingView>
        {showRoles && <TouchableOpacity activeOpacity={1} onPress={() => setShowRoles(false)} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />}
        {showRoles && sidebar}

      </View>
    );
  }
  return content;
}

const s = {
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12, backgroundColor: '#f5f5f5',
  },
};
