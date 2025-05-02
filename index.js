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
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const warns = new Map();

const staffRoleId = '1360865629489467474';
const blacklistRoleId = '1362037425228091453';
const mutedRoleId = '1361533033261432875';

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Internal keep-alive trigger
  setInterval(() => {
    fakeCommandHandler();
  }, 14 * 60 * 1000); // Every 14 minutes
});

function fakeCommandHandler() {
  console.log(`[${new Date().toISOString()}] Keep-alive ping triggered internally.`);
}

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

  function hasHigherRole(targetUser) {
    return message.member.roles.highest.position > targetUser.roles.highest.position;
  }

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

    if (!hasHigherRole(user)) {
      return message.reply('You cannot warn someone with a higher or equal role.');
    }

    const userWarns = warns.get(user.id) || [];
    userWarns.push({
      reason,
      moderator: message.author.tag,
      modId: message.author.id,
      date: new Date(),
    });
    warns.set(user.id, userWarns);

    const warnCount = userWarns.length;

    await message.reply(`${user} has been warned. Total warns: ${warnCount}`);
    await user.send(`You have been warned in ${message.guild.name} for: ${reason}\nTotal warnings: ${warnCount}`);

    if (warnCount === 1) {
      await message.channel.send(`⚠️ ${user} has received their **first warning**. Please follow the rules.`);
    } else if (warnCount === 2) {
      await user.roles.add(mutedRoleId);
      await message.channel.send(`⚠️ ${user} now has **2 warnings** and has been muted for **30 minutes**.`);
      await user.send(`You have been muted for 30 minutes due to accumulating 2 warnings.`);
      setTimeout(async () => {
        if (user.roles.cache.has(mutedRoleId)) {
          await user.roles.remove(mutedRoleId).catch(() => {});
          await user.send(`You have been automatically unmuted in ${message.guild.name}.`).catch(() => {});
        }
      }, ms('30m'));
    } else if (warnCount === 3) {
      await user.roles.add(mutedRoleId);
      await message.channel.send(`⚠️ ${user} now has **3 warnings** and has been muted for **1 hour**. Messages may be cleaned up.`);
      await user.send(`You have been muted for 1 hour due to accumulating 3 warnings.`);
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
      await user.send(`You have been blacklisted in ${message.guild.name} due to repeated offenses.`);
    }
  }

  if (command === '?warns') {
    const user = message.mentions.members.first();
    if (!user) return message.reply('Usage: `?warns @user`');

    if (!hasHigherRole(user)) {
      return message.reply('You cannot view warns for someone with a higher or equal role.');
    }

    if (user.id === message.author.id) {
      return message.reply('You cannot view your own warns.');
    }

    const userWarns = warns.get(user.id) || [];
    if (userWarns.length === 0) return message.reply(`${user} has no warns.`);

    const warnList = userWarns
      .map((w, i) => `**#${i + 1}**: ${w.reason} (Moderator: ${w.moderator}, Date: ${w.date.toLocaleString()})`)
      .join('\n');
    message.reply(`Warns for ${user}:\n${warnList}`);
  }

  if (command === '?removewarn') {
    const user = message.mentions.members.first();
    const number = parseInt(args[1]);
    if (!user || isNaN(number)) return message.reply('Usage: `?removewarn @user warnNumber`');

    if (!hasHigherRole(user)) {
      return message.reply('You cannot remove warns from someone with a higher or equal role.');
    }

    if (user.id === message.author.id) {
      return message.reply('You cannot remove your own warns.');
    }

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

    if (!hasHigherRole(user)) {
      return message.reply('You cannot blacklist someone with a higher or equal role.');
    }

    await user.roles.add(blacklistRoleId);
    message.reply(`${user} has been successfully blacklisted.`);
    await user.send(`You have been blacklisted from ${message.guild.name}.\nReason: ${reason}`);
  }

  if (command === '?whitelist') {
    const user = message.mentions.members.first();
    if (!user) return message.reply('Usage: `?whitelist @user`');

    if (!hasHigherRole(user)) {
      return message.reply('You cannot whitelist someone with a higher or equal role.');
    }

    await user.roles.remove(blacklistRoleId);
    message.reply(`${user} has been successfully whitelisted.`);
    await user.send(`You have been whitelisted and are no longer blacklisted in ${message.guild.name}.`);
  }
});

client.login(process.env.TOKEN);