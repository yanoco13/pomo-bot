import 'dotenv/config';
import { Collection, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { client } from './client.js';
import { handleButton, handleSelectMenu, handleModalSubmit } from './handlers/interactions.js';

interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const commands = new Collection<string, Command>();

async function loadCommands(): Promise<void> {
  const { data: pomoData, execute: pomoExecute } = await import('./commands/pomo.js');
  const { data: stopData, execute: stopExecute } = await import('./commands/stop.js');
  const { data: settingsData, execute: settingsExecute } = await import('./commands/settings.js');

  commands.set(pomoData.name, { data: pomoData, execute: pomoExecute });
  commands.set(stopData.name, { data: stopData, execute: stopExecute });
  commands.set(settingsData.name, { data: settingsData, execute: settingsExecute });
}

client.once('ready', (c) => {
  console.log(`✅ ${c.user.tag} として起動しました`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (error) {
    console.error(error);
    if ('replied' in interaction && 'deferred' in interaction) {
      const int = interaction as ChatInputCommandInteraction;
      if (int.replied || int.deferred) {
        await int.followUp({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] });
      } else {
        await int.reply({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] });
      }
    }
  }
});

await loadCommands();
await client.login(process.env.DISCORD_TOKEN);
