import { TextChannel, EmbedBuilder } from 'discord.js';
import { playTts } from './tts.js';
import type { UserConfig } from './config.js';

export type Phase = 'work' | 'break';

export interface TimerSession {
  workMinutes: number;
  breakMinutes: number;
  phase: Phase;
  startedAt: Date;
  endsAt: Date;
  cycleCount: number;
  speakerId: number;
  workStartPhrase: string;
  breakStartPhrase: string;
  reminderInterval: number;
  reminderPhrase: string;
  guildId: string;
  voiceChannelId: string;
  textChannel: TextChannel;
  messageId: string;
  phaseTimeout: ReturnType<typeof setTimeout>;
  updateInterval: ReturnType<typeof setInterval>;
  reminderTimer: ReturnType<typeof setInterval> | null;
  paused: boolean;
  pausedAt: Date | null;
}

const sessions = new Map<string, TimerSession>();

function buildProgressBar(startedAt: Date, endsAt: Date, frozenAt?: Date): string {
  const total = endsAt.getTime() - startedAt.getTime();
  const elapsed = (frozenAt ?? new Date()).getTime() - startedAt.getTime();
  const ratio = Math.min(Math.max(elapsed / total, 0), 1);
  const filled = Math.round(ratio * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function buildEmbed(session: TimerSession): EmbedBuilder {
  const isWork = session.phase === 'work';
  const bar = buildProgressBar(session.startedAt, session.endsAt, session.pausedAt ?? undefined);
  const endTimestamp = Math.floor(session.endsAt.getTime() / 1000);

  if (session.paused) {
    const remainingMs = session.endsAt.getTime() - session.pausedAt!.getTime();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return new EmbedBuilder()
      .setTitle('⏸️ 一時停止中')
      .setColor(0xf39c12)
      .addFields(
        { name: 'フェーズ', value: isWork ? '🍅 作業中（停止）' : '☕ 休憩中（停止）', inline: true },
        { name: '作業時間', value: `${session.workMinutes}分`, inline: true },
        { name: '休憩時間', value: `${session.breakMinutes}分`, inline: true },
        { name: 'サイクル数', value: `${session.cycleCount}回目`, inline: true },
        { name: '残り時間', value: `${remainingMin}分`, inline: true },
        { name: '進捗', value: `\`${bar}\`` },
      )
      .setTimestamp();
  }

  const color = isWork ? 0xe74c3c : 0x2ecc71;
  return new EmbedBuilder()
    .setTitle(isWork ? '🍅 ポモドーロ進行中' : '☕ 休憩中')
    .setColor(color)
    .addFields(
      { name: 'フェーズ', value: isWork ? '🍅 作業中' : '☕ 休憩中', inline: true },
      { name: '作業時間', value: `${session.workMinutes}分`, inline: true },
      { name: '休憩時間', value: `${session.breakMinutes}分`, inline: true },
      { name: 'サイクル数', value: `${session.cycleCount}回目`, inline: true },
      { name: '終了予定', value: `<t:${endTimestamp}:T> (<t:${endTimestamp}:R>)`, inline: true },
      { name: '進捗', value: `\`${bar}\`` },
    )
    .setTimestamp();
}

export function buildCurrentEmbed(session: TimerSession): EmbedBuilder {
  return buildEmbed(session);
}

export function buildStoppedEmbed(session: TimerSession): EmbedBuilder {
  const bar = buildProgressBar(session.startedAt, session.endsAt, session.pausedAt ?? undefined);
  return new EmbedBuilder()
    .setTitle('⏹️ 停止済み')
    .setColor(0x95a5a6)
    .addFields(
      { name: '作業時間', value: `${session.workMinutes}分`, inline: true },
      { name: '休憩時間', value: `${session.breakMinutes}分`, inline: true },
      { name: '完了サイクル数', value: `${session.cycleCount}回`, inline: true },
      { name: '進捗', value: `\`${bar}\`` },
    )
    .setTimestamp();
}

async function schedulePhase(vcId: string, durationMs: number): Promise<void> {
  const session = sessions.get(vcId);
  if (!session) return;

  await session.textChannel.messages
    .fetch(session.messageId)
    .then((msg) => msg.edit({ embeds: [buildEmbed(session)] }))
    .catch((e) => console.error('[TTS]', e));

  if (!sessions.has(vcId)) return;

  clearInterval(session.updateInterval);
  session.updateInterval = setInterval(async () => {
    const s = sessions.get(vcId);
    if (!s || s.paused) return;
    await s.textChannel.messages
      .fetch(s.messageId)
      .then((msg) => msg.edit({ embeds: [buildEmbed(s)] }))
      .catch((e) => console.error('[TTS]', e));
  }, 60 * 1000);

  if (session.reminderTimer) clearInterval(session.reminderTimer);
  session.reminderTimer = null;
  if (session.phase === 'work' && session.reminderInterval > 0) {
    session.reminderTimer = setInterval(async () => {
      const s = sessions.get(vcId);
      if (!s || s.phase !== 'work' || s.paused) return;
      const remaining = Math.max(1, Math.ceil((s.endsAt.getTime() - Date.now()) / 60000));
      const phrase = s.reminderPhrase.replace('{remaining}', String(remaining));
      await playTts(phrase, s.speakerId, s.guildId, s.voiceChannelId).catch((e) => console.error('[TTS]', e));
    }, session.reminderInterval * 60 * 1000);
  }

  session.phaseTimeout = setTimeout(async () => {
    const s = sessions.get(vcId);
    if (!s) return;

    if (s.reminderTimer) {
      clearInterval(s.reminderTimer);
      s.reminderTimer = null;
    }

    if (s.phase === 'work') {
      s.phase = 'break';
      const breakMs = s.breakMinutes * 60 * 1000;
      s.startedAt = new Date();
      s.endsAt = new Date(Date.now() + breakMs);
      const phrase = s.breakStartPhrase.replace('{break}', String(s.breakMinutes));
      await playTts(phrase, s.speakerId, s.guildId, s.voiceChannelId).catch((e) => console.error('[TTS]', e));
      await schedulePhase(vcId, breakMs);
    } else {
      s.phase = 'work';
      s.cycleCount += 1;
      const workMs = s.workMinutes * 60 * 1000;
      s.startedAt = new Date();
      s.endsAt = new Date(Date.now() + workMs);
      const phrase = s.workStartPhrase.replace('{work}', String(s.workMinutes));
      await playTts(phrase, s.speakerId, s.guildId, s.voiceChannelId).catch((e) => console.error('[TTS]', e));
      await schedulePhase(vcId, workMs);
    }
  }, durationMs);
}

export async function startTimer(
  voiceChannelId: string,
  guildId: string,
  textChannel: TextChannel,
  config: UserConfig,
): Promise<void> {
  stopTimer(voiceChannelId);

  const workMs = config.workMinutes * 60 * 1000;
  const now = new Date();
  const endsAt = new Date(now.getTime() + workMs);

  const embed = new EmbedBuilder()
    .setTitle('🍅 ポモドーロ進行中')
    .setColor(0xe74c3c)
    .addFields(
      { name: 'フェーズ', value: '🍅 作業中', inline: true },
      { name: '作業時間', value: `${config.workMinutes}分`, inline: true },
      { name: '休憩時間', value: `${config.breakMinutes}分`, inline: true },
      { name: 'サイクル数', value: '1回目', inline: true },
      { name: '終了予定', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:T> (<t:${Math.floor(endsAt.getTime() / 1000)}:R>)`, inline: true },
      { name: '進捗', value: '`░░░░░░░░░░`' },
    )
    .setTimestamp();

  const message = await textChannel.send({ embeds: [embed] });

  const session: TimerSession = {
    workMinutes: config.workMinutes,
    breakMinutes: config.breakMinutes,
    phase: 'work',
    startedAt: now,
    endsAt,
    cycleCount: 1,
    speakerId: config.speakerId,
    workStartPhrase: config.workStartPhrase,
    breakStartPhrase: config.breakStartPhrase,
    reminderInterval: config.reminderInterval,
    reminderPhrase: config.reminderPhrase,
    guildId,
    voiceChannelId,
    textChannel,
    messageId: message.id,
    phaseTimeout: setTimeout(() => {}, 0),
    updateInterval: setInterval(() => {}, 0),
    reminderTimer: null,
    paused: false,
    pausedAt: null,
  };

  sessions.set(voiceChannelId, session);
  clearTimeout(session.phaseTimeout);
  clearInterval(session.updateInterval);

  const phrase = config.workStartPhrase.replace('{work}', String(config.workMinutes));
  await playTts(phrase, config.speakerId, guildId, voiceChannelId).catch((e) => console.error('[TTS]', e));

  await schedulePhase(voiceChannelId, workMs);
}

export function pauseTimer(vcId: string): boolean {
  const session = sessions.get(vcId);
  if (!session || session.paused) return false;

  clearTimeout(session.phaseTimeout);
  clearInterval(session.updateInterval);
  if (session.reminderTimer) {
    clearInterval(session.reminderTimer);
    session.reminderTimer = null;
  }

  session.paused = true;
  session.pausedAt = new Date();
  return true;
}

export async function resumeTimer(vcId: string): Promise<boolean> {
  const session = sessions.get(vcId);
  if (!session || !session.paused || !session.pausedAt) return false;

  const remainingMs = Math.max(0, session.endsAt.getTime() - session.pausedAt.getTime());
  const totalMs =
    (session.phase === 'work' ? session.workMinutes : session.breakMinutes) * 60 * 1000;

  session.paused = false;
  session.startedAt = new Date(Date.now() - (totalMs - remainingMs));
  session.endsAt = new Date(Date.now() + remainingMs);
  session.pausedAt = null;

  await schedulePhase(vcId, remainingMs);
  return true;
}

export function stopTimer(vcId: string): boolean {
  const session = sessions.get(vcId);
  if (!session) return false;

  clearTimeout(session.phaseTimeout);
  clearInterval(session.updateInterval);
  if (session.reminderTimer) clearInterval(session.reminderTimer);
  sessions.delete(vcId);
  return true;
}

export function getSession(vcId: string): TimerSession | undefined {
  return sessions.get(vcId);
}
