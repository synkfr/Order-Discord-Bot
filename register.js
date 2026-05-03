require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('order')
        .setDescription('Start a new order ticket (Staff only)')
        .addAttachmentOption(option => 
            option.setName('reference')
                .setDescription('Optional image or document reference')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('review')
        .setDescription('Submit a review for a service')
        .addUserOption(option => 
            option.setName('employee')
                .setDescription('The employee who provided the service')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('Post your portfolio in the portfolio channel')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
