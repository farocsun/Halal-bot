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
\`?whitelist @user reason\` - Remove blacklist
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

        const warnCount = userWarns.length;

        await message.reply(`${user} has been warned. Total warns: ${warnCount}`);
        await user.send(`
━━━━━━━〔 WARN NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: ${reason}
Warn Number: ${warnCount}
Moderator: ${message.author.tag} (ID: ${message.author.id})
Mute ID: #WARN-${warnCount}
This is an automated warning by Halal Bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

        // Punishment system based on warns
        if (warnCount === 1) {
            await message.channel.send(`⚠️ ${user} has received their **first warning**. Please follow the rules.`);
        } else if (warnCount === 2) {
            await user.roles.add(mutedRoleId);
            await message.channel.send(`⚠️ ${user} now has **2 warnings** and has been muted for **30 minutes**.`);
            await user.send(`
━━━━━━━〔 MUTE NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: Accumulated 2 warnings
Mute Ends: ${new Date(Date.now() + ms('30m')).toLocaleString()}
Moderator: ${message.author.tag} (ID: ${message.author.id})
Mute ID: #MUTE-5821
This is an automated mute by Halal Bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `);
            setTimeout(async () => {
                if (user.roles.cache.has(mutedRoleId)) {
                    await user.roles.remove(mutedRoleId).catch(() => {});
                    await user.send(`You have been automatically unmuted in ${message.guild.name}.`).catch(() => {});
                }
            }, ms('30m'));
        } else if (warnCount === 3) {
            await user.roles.add(mutedRoleId);
            await message.channel.send(`⚠️ ${user} now has **3 warnings** and has been muted for **1 hour**.`);
            await user.send(`
━━━━━━━〔 MUTE NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: Accumulated 3 warnings
Mute Ends: ${new Date(Date.now() + ms('1h')).toLocaleString()}
Moderator: ${message.author.tag} (ID: ${message.author.id})
Mute ID: #MUTE-5822
This is an automated mute by Halal Bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `);
            setTimeout(async () => {
                if (user.roles.cache.has(mutedRoleId)) {
                    await user.roles.remove(mutedRoleId).catch(() => {});
                    await user.send(`You have been automatically unmuted in ${message.guild.name}.`).catch(() => {});
                }
            }, ms('1h'));
        } else if (warnCount === 4) {
            await user.kick('4 warnings reached - Kicked by bot');
            await message.channel.send(`⚠️ ${user.user.tag} has been kicked from the server after receiving 4 warnings.`);
        } else if (warnCount === 5) {
            await user.ban({ reason: '5 warnings reached - Banned by bot' });
            await message.channel.send(`⚠️ ${user.user.tag} has been permanently banned after receiving 5 warnings.`);
        } else if (warnCount >= 6) {
            await user.roles.add(blacklistRoleId);
            await message.channel.send(`⚠️ ${user.user.tag} has been blacklisted due to 6 or more warnings.`);
            await user.send(`
━━━━━━━〔 BLACKLIST NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: Repeated offenses (6+ warnings)
Moderator: ${message.author.tag} (ID: ${message.author.id})
Blacklist ID: #BLACKLIST-5823
This is an automated blacklist by Halal Bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `);
        }
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
        await user.send(`
━━━━━━━〔 BLACKLIST NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: ${reason}
Moderator: ${message.author.tag} (ID: ${message.author.id})
Blacklist ID: #BLACKLIST-5824
This is an automated blacklist by Halal Bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }

    if (command === '?whitelist') {
        const user = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'No reason provided.';
        if (!user) return message.reply('Usage: `?whitelist @user reason`');

        await user.roles.remove(blacklistRoleId);
        message.reply(`${user} has been successfully whitelisted.`);
        await user.send(`
━━━━━━━〔 WHITELIST NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: ${reason}
Moderator: ${message.author.tag} (ID: ${message.author.id})
Whitelist ID: #WHITELIST-5825
You have been whitelisted and are no longer blacklisted in ${message.guild.name}.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
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
        await user.send(`
━━━━━━━〔 MUTE NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: ${reason}
Mute Ends: <t:${Math.floor((Date.now() + duration) / 1000)}:F>
Moderator: ${message.author.tag} (ID: ${message.author.id})
Mute ID: #MUTE-5826
This is an automated mute by Halal Bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

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
        await user.send(`
━━━━━━━〔 UNMUTE NOTICE 〕━━━━━━━
Server: ${message.guild.name}
Reason: Unmuted by moderator
Moderator: ${message.author.tag} (ID: ${message.author.id})
Unmute ID: #UNMUTE-5827
You have been unmuted in ${message.guild.name}.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }
});

client.login(process.env.BOT_TOKEN)