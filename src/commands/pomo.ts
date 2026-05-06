import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  GuildMember,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { buildSettingsEmbed } from './settings.js';

export type PomoState = 'idle' | 'running' | 'paused';

export const data = new SlashCommandBuilder()
  .setName('pomo')
  .setDescription('ポモドーロを開始します（設定確認・変更後に開始できます）')
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('通知先のボイスチャンネル（省略時は現在参加中のチャンネル）')
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(false),
  );

export function buildPomoPanel(userId: string, vcId: string, state: PomoState = 'idle') {
  let actionRow: ActionRowBuilder<ButtonBuilder>;
  if (state === 'running') {
    actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`pomo_pause:${vcId}`).setLabel('⏸️ 一時停止').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`pomo_reset:${vcId}`).setLabel('🔄 リセット').setStyle(ButtonStyle.Danger),
    );
  } else if (state === 'paused') {
    actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`pomo_resume:${vcId}`).setLabel('▶️ 再開').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`pomo_reset:${vcId}`).setLabel('🔄 リセット').setStyle(ButtonStyle.Danger),
    );
  } else {
    actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`pomo_start:${vcId}`).setLabel('▶️ 開始').setStyle(ButtonStyle.Success),
    );
  }

  return {
    embeds: [buildSettingsEmbed(userId)],
    components: [
      actionRow,
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`pomo_time:${vcId}`).setLabel('⏱️ 時間設定').setStyle(ButtonStyle.Primary).setDisabled(state === 'running'),
        new ButtonBuilder().setCustomId(`pomo_char:${vcId}`).setLabel('🗣️ キャラクター').setStyle(ButtonStyle.Primary).setDisabled(state === 'running'),
        new ButtonBuilder().setCustomId(`pomo_phrase:${vcId}`).setLabel('💬 フレーズ').setStyle(ButtonStyle.Primary).setDisabled(state === 'running'),
        new ButtonBuilder().setCustomId(`pomo_reminder:${vcId}`).setLabel('⏰ リマインド').setStyle(ButtonStyle.Primary).setDisabled(state === 'running'),
      ),
    ],
  };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const specifiedChannel = interaction.options.getChannel('channel');
  const voiceChannel = specifiedChannel ?? member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '⚠️ ボイスチャンネルを指定するか、ボイスチャンネルに参加してください。',
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  await interaction.reply({
    ...buildPomoPanel(interaction.user.id, voiceChannel.id, 'idle'),
    flags: [MessageFlags.Ephemeral],
  });
}
