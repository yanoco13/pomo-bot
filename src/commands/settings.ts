import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { getConfig, VOICEVOX_SPEAKERS } from '../services/config.js';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('ポモドーロの設定を変更します');

export function buildSettingsEmbed(userId: string): EmbedBuilder {
  const config = getConfig(userId);
  const speaker = VOICEVOX_SPEAKERS.find((s) => s.id === config.speakerId);
  const reminderValue =
    config.reminderInterval > 0
      ? `${config.reminderInterval}分おき\nフレーズ: \`${config.reminderPhrase}\``
      : 'なし';

  return new EmbedBuilder()
    .setTitle('⚙️ ポモドーロ設定')
    .setColor(0x3498db)
    .addFields(
      { name: '⏱️ 作業時間', value: `${config.workMinutes}分`, inline: true },
      { name: '☕ 休憩時間', value: `${config.breakMinutes}分`, inline: true },
      { name: '🗣️ キャラクター', value: speaker?.name ?? `ID: ${config.speakerId}`, inline: true },
      { name: '💬 作業開始フレーズ', value: `\`${config.workStartPhrase}\`` },
      { name: '💬 休憩開始フレーズ', value: `\`${config.breakStartPhrase}\`` },
      { name: '⏰ リマインド', value: reminderValue },
    );
}

export function buildSettingsRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('settings_time')
        .setLabel('⏱️ 時間設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings_character')
        .setLabel('🗣️ キャラクター')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings_phrase')
        .setLabel('💬 フレーズ')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings_reminder')
        .setLabel('⏰ リマインド')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    embeds: [buildSettingsEmbed(interaction.user.id)],
    components: buildSettingsRows(),
    flags: [MessageFlags.Ephemeral],
  });
}
