import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { getConfig, setConfig, VOICEVOX_SPEAKERS } from '../services/config.js';
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getSession,
  buildCurrentEmbed,
  buildStoppedEmbed,
} from '../services/timer.js';
import { buildSettingsEmbed, buildSettingsRows } from '../commands/settings.js';
import { buildPomoPanel } from '../commands/pomo.js';

// ─── ボタンハンドラ ───────────────────────────────────────────────

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const id = interaction.customId;
  if (id.startsWith('pomo_')) {
    await handlePomoButton(interaction);
  } else if (id.startsWith('settings_')) {
    await handleSettingsButton(interaction);
  }
}

async function handlePomoButton(interaction: ButtonInteraction): Promise<void> {
  const colonIdx = interaction.customId.indexOf(':');
  const prefix = interaction.customId.slice(0, colonIdx);
  const vcId = interaction.customId.slice(colonIdx + 1);

  switch (prefix) {
    case 'pomo_start':
      await startPomoTimer(interaction, vcId);
      break;
    case 'pomo_pause':
      await pausePomoTimer(interaction, vcId);
      break;
    case 'pomo_resume':
      await resumePomoTimer(interaction, vcId);
      break;
    case 'pomo_reset':
      await resetPomoTimer(interaction, vcId);
      break;
    case 'pomo_time':
      await showTimeModal(interaction, `pomo_modal_time:${vcId}`);
      break;
    case 'pomo_char':
      await showPomoCharacterSelect(interaction, vcId);
      break;
    case 'pomo_phrase':
      await showPhraseModal(interaction, `pomo_modal_phrase:${vcId}`);
      break;
    case 'pomo_reminder':
      await showReminderModal(interaction, `pomo_modal_reminder:${vcId}`);
      break;
    case 'pomo_back':
      await interaction.update(buildPomoPanel(interaction.user.id, vcId));
      break;
  }
}

async function handleSettingsButton(interaction: ButtonInteraction): Promise<void> {
  switch (interaction.customId) {
    case 'settings_time':
      await showTimeModal(interaction, 'modal_time');
      break;
    case 'settings_character':
      await showSettingsCharacterSelect(interaction);
      break;
    case 'settings_phrase':
      await showPhraseModal(interaction, 'modal_phrase');
      break;
    case 'settings_reminder':
      await showReminderModal(interaction, 'modal_reminder');
      break;
    case 'settings_back':
      await interaction.update({
        embeds: [buildSettingsEmbed(interaction.user.id)],
        components: buildSettingsRows(),
      });
      break;
  }
}

// ─── タイマー操作 ─────────────────────────────────────────────────

async function startPomoTimer(interaction: ButtonInteraction, vcId: string): Promise<void> {
  await interaction.deferUpdate();
  const config = getConfig(interaction.user.id);
  const textChannel = interaction.channel as TextChannel;

  await startTimer(vcId, interaction.guildId!, textChannel, config);

  await interaction.editReply({ ...buildPomoPanel(interaction.user.id, vcId, 'running'), content: '' });
}

async function pausePomoTimer(interaction: ButtonInteraction, vcId: string): Promise<void> {
  await interaction.deferUpdate();
  const session = getSession(vcId);
  if (session) {
    pauseTimer(vcId);
    const paused = getSession(vcId);
    if (paused) {
      await paused.textChannel.messages
        .fetch(paused.messageId)
        .then((msg) => msg.edit({ embeds: [buildCurrentEmbed(paused)] }))
        .catch(() => {});
    }
  }

  await interaction.editReply({ ...buildPomoPanel(interaction.user.id, vcId, 'paused'), content: '' });
}

async function resumePomoTimer(interaction: ButtonInteraction, vcId: string): Promise<void> {
  await interaction.deferUpdate();
  await resumeTimer(vcId);
  await interaction.editReply({ ...buildPomoPanel(interaction.user.id, vcId, 'running'), content: '' });
}

async function resetPomoTimer(interaction: ButtonInteraction, vcId: string): Promise<void> {
  await interaction.deferUpdate();
  const session = getSession(vcId);
  if (session) {
    await session.textChannel.messages
      .fetch(session.messageId)
      .then((msg) => msg.edit({ embeds: [buildStoppedEmbed(session)] }))
      .catch(() => {});
    stopTimer(vcId);
    getVoiceConnection(interaction.guildId!)?.destroy();
  }

  await interaction.editReply({ ...buildPomoPanel(interaction.user.id, vcId, 'idle'), content: '' });
}

// ─── モーダル表示 ─────────────────────────────────────────────────

async function showTimeModal(interaction: ButtonInteraction, modalId: string): Promise<void> {
  const config = getConfig(interaction.user.id);
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('⏱️ 時間設定');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('work_minutes')
        .setLabel('作業時間（1〜120分）')
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.workMinutes))
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('break_minutes')
        .setLabel('休憩時間（1〜60分）')
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.breakMinutes))
        .setRequired(true),
    ),
  );
  await interaction.showModal(modal);
}

async function showPhraseModal(interaction: ButtonInteraction, modalId: string): Promise<void> {
  const config = getConfig(interaction.user.id);
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('💬 フレーズ設定');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('work_start_phrase')
        .setLabel('作業開始フレーズ（{work}=作業時間分）')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.workStartPhrase)
        .setMaxLength(200)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('break_start_phrase')
        .setLabel('休憩開始フレーズ（{break}=休憩時間分）')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.breakStartPhrase)
        .setMaxLength(200)
        .setRequired(true),
    ),
  );
  await interaction.showModal(modal);
}

async function showReminderModal(interaction: ButtonInteraction, modalId: string): Promise<void> {
  const config = getConfig(interaction.user.id);
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('⏰ リマインド設定');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reminder_interval')
        .setLabel('リマインド間隔（分、0で無効）')
        .setStyle(TextInputStyle.Short)
        .setValue(String(config.reminderInterval))
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reminder_phrase')
        .setLabel('リマインドフレーズ（{remaining}=残り時間分）')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.reminderPhrase)
        .setMaxLength(200)
        .setRequired(true),
    ),
  );
  await interaction.showModal(modal);
}

// ─── キャラクター選択 ─────────────────────────────────────────────

function buildCharacterSelectComponents(
  config: ReturnType<typeof getConfig>,
  backButtonId: string,
  selectId: string,
) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(selectId)
    .setPlaceholder('キャラクターを選択してください')
    .addOptions(
      VOICEVOX_SPEAKERS.map((s) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(s.name)
          .setValue(String(s.id))
          .setDefault(s.id === config.speakerId),
      ),
    );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(backButtonId).setLabel('← 戻る').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

async function showSettingsCharacterSelect(interaction: ButtonInteraction): Promise<void> {
  const config = getConfig(interaction.user.id);
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle('🗣️ キャラクター選択')
        .setColor(0x3498db)
        .setDescription('使用するVOICEVOXのキャラクターを選択してください。'),
    ],
    components: buildCharacterSelectComponents(config, 'settings_back', 'select_character'),
  });
}

async function showPomoCharacterSelect(interaction: ButtonInteraction, vcId: string): Promise<void> {
  const config = getConfig(interaction.user.id);
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle('🗣️ キャラクター選択')
        .setColor(0x3498db)
        .setDescription('使用するVOICEVOXのキャラクターを選択してください。'),
    ],
    components: buildCharacterSelectComponents(
      config,
      `pomo_back:${vcId}`,
      `pomo_select_char:${vcId}`,
    ),
  });
}

// ─── セレクトメニューハンドラ ─────────────────────────────────────

export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const id = interaction.customId;
  const speakerId = parseInt(interaction.values[0]);
  setConfig(interaction.user.id, { speakerId });

  if (id === 'select_character') {
    await interaction.update({
      embeds: [buildSettingsEmbed(interaction.user.id)],
      components: buildSettingsRows(),
    });
  } else if (id.startsWith('pomo_select_char:')) {
    const vcId = id.slice('pomo_select_char:'.length);
    await interaction.update(buildPomoPanel(interaction.user.id, vcId));
  }
}

// ─── モーダル送信ハンドラ ─────────────────────────────────────────

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.customId;
  const isPomo = id.startsWith('pomo_modal_');
  const vcId = isPomo ? id.split(':')[1] : null;

  if (id === 'modal_time' || id.startsWith('pomo_modal_time:')) {
    const workMinutes = parseInt(interaction.fields.getTextInputValue('work_minutes'));
    const breakMinutes = parseInt(interaction.fields.getTextInputValue('break_minutes'));
    if (isNaN(workMinutes) || workMinutes < 1 || workMinutes > 120) {
      await interaction.reply({ content: '⚠️ 作業時間は1〜120の数値で入力してください。', flags: [MessageFlags.Ephemeral] });
      return;
    }
    if (isNaN(breakMinutes) || breakMinutes < 1 || breakMinutes > 60) {
      await interaction.reply({ content: '⚠️ 休憩時間は1〜60の数値で入力してください。', flags: [MessageFlags.Ephemeral] });
      return;
    }
    setConfig(interaction.user.id, { workMinutes, breakMinutes });

  } else if (id === 'modal_phrase' || id.startsWith('pomo_modal_phrase:')) {
    const workStartPhrase = interaction.fields.getTextInputValue('work_start_phrase');
    const breakStartPhrase = interaction.fields.getTextInputValue('break_start_phrase');
    setConfig(interaction.user.id, { workStartPhrase, breakStartPhrase });

  } else if (id === 'modal_reminder' || id.startsWith('pomo_modal_reminder:')) {
    const reminderInterval = parseInt(interaction.fields.getTextInputValue('reminder_interval'));
    const reminderPhrase = interaction.fields.getTextInputValue('reminder_phrase');
    if (isNaN(reminderInterval) || reminderInterval < 0 || reminderInterval > 120) {
      await interaction.reply({ content: '⚠️ リマインド間隔は0〜120の数値で入力してください。', flags: [MessageFlags.Ephemeral] });
      return;
    }
    setConfig(interaction.user.id, { reminderInterval, reminderPhrase });

  } else {
    return;
  }

  if (isPomo && vcId) {
    await interaction.reply({ ...buildPomoPanel(interaction.user.id, vcId), flags: [MessageFlags.Ephemeral] });
  } else {
    await interaction.reply({
      embeds: [buildSettingsEmbed(interaction.user.id)],
      components: buildSettingsRows(),
      flags: [MessageFlags.Ephemeral],
    });
  }
}
