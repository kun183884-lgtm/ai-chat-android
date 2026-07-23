import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  API_KEY: 'ai_chat_api_key',
  API_URL: 'ai_chat_api_url',
  MODEL: 'ai_chat_model',
  HISTORY: 'ai_chat_history',
  CHARACTER: 'ai_chat_character',
};

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Character {
  id: string;
  name: string;
  avatar?: string;
  systemPrompt: string;
}

export interface Settings {
  apiKey: string;
  apiUrl: string;
  model: string;
}

export async function getSettings(): Promise<Settings> {
  const [apiKey, apiUrl, model] = await Promise.all([
    AsyncStorage.getItem(KEYS.API_KEY),
    AsyncStorage.getItem(KEYS.API_URL),
    AsyncStorage.getItem(KEYS.MODEL),
  ]);
  return {
    apiKey: apiKey || '',
    apiUrl: apiUrl || 'https://api.openai.com/v1',
    model: model || 'gpt-3.5-turbo',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.API_KEY, settings.apiKey),
    AsyncStorage.setItem(KEYS.API_URL, settings.apiUrl),
    AsyncStorage.setItem(KEYS.MODEL, settings.model),
  ]);
}

export async function getCharacters(): Promise<Character[]> {
  const data = await AsyncStorage.getItem(KEYS.CHARACTER);
  return data ? JSON.parse(data) : [];
}

export async function saveCharacters(characters: Character[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CHARACTER, JSON.stringify(characters));
}

export async function getHistory(charId: string): Promise<Message[]> {
  const key = `${KEYS.HISTORY}_${charId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

export async function saveHistory(charId: string, messages: Message[]): Promise<void> {
  const key = `${KEYS.HISTORY}_${charId}`;
  await AsyncStorage.setItem(key, JSON.stringify(messages));
}
