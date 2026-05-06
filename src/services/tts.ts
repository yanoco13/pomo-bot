import { Readable } from 'node:stream';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection,
} from '@discordjs/voice';
import { client } from '../client.js';

const VOICEVOX_URL = process.env.VOICEVOX_URL ?? 'http://localhost:50021';

async function generateVoicevoxAudio(text: string, speakerId: number): Promise<Buffer> {
  const queryRes = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
    { method: 'POST' },
  );
  if (!queryRes.ok) throw new Error(`VOICEVOX audio_query failed: ${queryRes.status}`);
  const query = await queryRes.json();

  const synthRes = await fetch(
    `${VOICEVOX_URL}/synthesis?speaker=${speakerId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    },
  );
  if (!synthRes.ok) throw new Error(`VOICEVOX synthesis failed: ${synthRes.status}`);

  return Buffer.from(await synthRes.arrayBuffer());
}

export async function playTts(
  text: string,
  speakerId: number,
  guildId: string,
  voiceChannelId: string,
): Promise<void> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(voiceChannelId);
  if (!channel || !channel.isVoiceBased()) return;

  const existing = getVoiceConnection(guildId);
  const connection = existing ?? joinVoiceChannel({
    channelId: voiceChannelId,
    guildId,
    adapterCreator: guild.voiceAdapterCreator,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

    const audioBuffer = await generateVoicevoxAudio(text, speakerId);

    const player = createAudioPlayer();
    const resource = createAudioResource(Readable.from(audioBuffer));

    connection.subscribe(player);
    player.play(resource);

    await entersState(player, AudioPlayerStatus.Idle, 30_000);
  } finally {
    if (!existing) {
      connection.destroy();
    }
  }
}
