const Discord = require("discord.js");
require('dotenv').config();
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });

client.on("ready", () => {
  console.log('Bot is ready');
});

client.on("message", msg => {
  if (msg.content === "@everyone") {
    

    msg.reply("Unpermitted use of everyone command, user muted.");
  }
});

client.login(process.env.TOKEN);
