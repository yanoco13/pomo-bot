import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { stopTimer, getSession, buildStoppedEmbed } from '../services/timer.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('ポモドーロタイマーを停止します');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const vcId = member.voice.channel?.id;

  if (!vcId) {
    await interaction.reply({
      content: '⚠️ ボイスチャンネルに参加してください。',
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const session = getSession(vcId);

  if (!session) {
    await interaction.reply({
      content: '⚠️ このボイスチャンネルで実行中のタイマーはありません。',
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  await session.textChannel.messages
    .fetch(session.messageId)
    .then((msg) => msg.edit({ embeds: [buildStoppedEmbed(session)] }))
    .catch(() => {});

  stopTimer(vcId);

  const connection = getVoiceConnection(interaction.guildId!);
  connection?.destroy();

  await interaction.reply({
    content: '⏹️ タイマーを停止しました。お疲れ様でした！',
    flags: [MessageFlags.Ephemeral],
  });
}
