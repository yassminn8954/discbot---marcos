require('dotenv').config();
const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { enviarNoCanal } = require('./src/services/discord');

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Responde com Pong!').toJSON(),
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot conectado como ${readyClient.user.tag}`);

  try {
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(readyClient.application.id, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(readyClient.application.id);

    await rest.put(route, { body: commands });
    console.log(`✅ Comandos registrados: ${commands.length}`);
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }

  if (process.env.DISCORD_CANAL_ID) {
    try {
      const idExterno = await enviarNoCanal(process.env.DISCORD_CANAL_ID, `Bot iniciado em ${new Date().toLocaleString('pt-BR')}`);
      console.log(`✅ Mensagem enviada para o canal com id_externo=${idExterno}`);
    } catch (error) {
      console.error('Erro ao enviar mensagem inicial:', error);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);
