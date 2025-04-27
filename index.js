const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is Alive!');
});

app.listen(port, () => {
  console.log(`Web server is running on port ${port}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

const warns = new Map();

const staffRoleId = '1360865629489467474';
const blacklistRoleId = '1362037425228091453';
const mutedRoleId = '1361533033261432875';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

function ms(input) {
    const match = input.match(/^(\d+)(m|h|d|w|y)$/);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        case 'w': return num * 7 * 24 * 60 * 60 * 1000;
        case 'y': return num * 365 * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.member.roles.cache.has(staffRoleId)) return;

    const args = message.content.trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === '?help') {
        const helpMessage = `
**Halal Bot Commands:**
\`?warn @user reason\` - Warn a user
\`?removewarn @user warnNumber\` - Remove a specific warn
\`?warns @user\` - View a user's warns
\`?blacklist @user reason\` - Blacklist a user
\`?whitelist @user\` - Remove blacklist
\`?mute @user time reason\` - Mute a user for a time
\`?unmute @user\` - Unmute a user
        `;
        return message.reply(helpMessage);
    }

    if (command === '?warn') {
        const user = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'No reason provided.';
        if (!user) return message.reply('Usage: `?warn @user reason`');

        const userWarns = warns.get(user.id) || [];
        userWarns.push({ reason, moderator: message.author.tag, modId: message.author.id, date: new Date() });
        warns.set(user.id, userWarns);

        await message.reply(`${user} has been warned.`);
        await user.send(`You have been warned in ${message.guild.name} for: ${reason}`);
    }

    if (command === '?warns') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Usage: `?warns @user`');

        const userWarns = warns.get(user.id) || [];
        if (userWarns.length === 0) return message.reply(`${user} has no warns.`);

        const warnList = userWarns.map((w, i) => `**#${i + 1}**: ${w.reason} (Moderator: ${w.moderator}, Date: ${w.date.toLocaleString()})`).join('\n');
        message.reply(`Warns for ${user}:\n${warnList}`);
    }

    if (command === '?removewarn') {
        const user = message.mentions.members.first();
        const number = parseInt(args[1]);
        if (!user || isNaN(number)) return message.reply('Usage: `?removewarn @user warnNumber`');

        const userWarns = warns.get(user.id) || [];
        if (number < 1 || number > userWarns.length) return message.reply('Invalid warn number.');

        userWarns.splice(number - 1, 1);
        warns.set(user.id, userWarns);

        message.reply(`Removed warn #${number} from ${user}.`);
    }

    if (command === '?blacklist') {
        const user = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'No reason provided.';
        if (!user) return message.reply('Usage: `?blacklist @user reason`');

        await user.roles.add(blacklistRoleId);
        message.reply(`${user} has been successfully blacklisted.`);
        await user.send(`You have been blacklisted from ${message.guild.name}.\nReason: ${reason}`);
    }

    if (command === '?whitelist') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Usage: `?whitelist @user`');

        await user.roles.remove(blacklistRoleId);
        message.reply(`${user} has been successfully whitelisted.`);
        await user.send(`You have been whitelisted and are no longer blacklisted in ${message.guild.name}.`);
    }

    if (command === '?mute') {
        const user = message.mentions.members.first();
        const timeInput = args[1];
        const reason = args.slice(2).join(' ') || 'No reason provided.';
        if (!user || !timeInput) return message.reply('Usage: `?mute @user 1h reason`');

        const duration = ms(timeInput);
        if (!duration) return message.reply('Invalid time format. Use like 1m, 1h, 1d, 1w, 1y.');

        await user.roles.add(mutedRoleId);
        message.reply(`${user} has been muted. Expected unmute: <t:${Math.floor((Date.now() + duration) / 1000)}:F>`);
        await user.send(`You have been muted in ${message.guild.name}.\nReason: ${reason}\nMute ends: <t:${Math.floor((Date.now() + duration) / 1000)}:F>`);

        setTimeout(async () => {
            if (user.roles.cache.has(mutedRoleId)) {
                await user.roles.remove(mutedRoleId).catch(() => {});
                await user.send(`You have been automatically unmuted in ${message.guild.name}.`).catch(() => {});
            }
        }, duration);
    }

    if (command === '?unmute') {
        const user = message.mentions.members.first();
        if (!user) return message.reply('Usage: `?unmute @user`');

        await user.roles.remove(mutedRoleId);
        message.reply(`${user} has been successfully unmuted.`);
        await user.send(`You have been unmuted in ${message.guild.name}.`);
    }
});

client.login(process.env.BOT_TOKEN);