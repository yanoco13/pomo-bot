import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface UserConfig {
  workMinutes: number;
  breakMinutes: number;
  speakerId: number;
  workStartPhrase: string;
  breakStartPhrase: string;
  reminderInterval: number;
  reminderPhrase: string;
}

export const VOICEVOX_SPEAKERS = [
  { id: 3, name: 'ずんだもん（ノーマル）' },
  { id: 1, name: 'ずんだもん（あまあま）' },
  { id: 7, name: 'ずんだもん（ツンツン）' },
  { id: 0, name: '四国めたん（ノーマル）' },
  { id: 2, name: '四国めたん（あまあま）' },
  { id: 6, name: '四国めたん（ツンツン）' },
  { id: 8, name: '春日部つむぎ（ノーマル）' },
] as const;

export const DEFAULT_CONFIG: UserConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  speakerId: 3,
  workStartPhrase: '作業を開始します。{work}分間頑張りましょう。',
  breakStartPhrase: '休憩を開始します。{break}分間ゆっくり休んでください。',
  reminderInterval: 0,
  reminderPhrase: 'あと{remaining}分で作業時間が終わります。',
};

const CONFIG_PATH = join(process.cwd(), 'data', 'config.json');

let store: Record<string, UserConfig> = {};

function load(): void {
  if (existsSync(CONFIG_PATH)) {
    store = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, UserConfig>;
  }
}

function save(): void {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

load();

export function getConfig(userId: string): UserConfig {
  return { ...DEFAULT_CONFIG, ...store[userId] };
}

export function setConfig(userId: string, partial: Partial<UserConfig>): UserConfig {
  store[userId] = { ...getConfig(userId), ...partial };
  save();
  return store[userId];
}
