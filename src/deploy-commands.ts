import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { data as pomoData } from './commands/pomo.js';
import { data as stopData } from './commands/stop.js';
import { data as settingsData } from './commands/settings.js';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID;

const commands = [pomoData.toJSON(), stopData.toJSON(), settingsData.toJSON()];
const rest = new REST().setToken(token);

const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

const scope = guildId ? `サーバー（${guildId}）` : 'グローバル';

try {
  console.log(`📡 ${commands.length}個のコマンドを${scope}に登録中...`);
  await rest.put(route, { body: commands });
  console.log('✅ コマンドの登録が完了しました');
} catch (error) {
  console.error(error);
}
