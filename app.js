const Discord = require("discord.js");
require('dotenv').config();
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });

client.on("ready", () => {
  console.log('Bot is ready');
});

client.on("message", msg => {
  if (msg.content.search("@everyone") >= 0) {
    if(!isPermitted(msg.member)) {
      msg.reply("no.");
    }
  }
});

client.login(process.env.TOKEN);

// check if the user is allowed to use the @everyone command
function isPermitted(user) {
  let permitted = false;
  if(user.permissions.has("MENTION_EVERYONE")) {
    permitted = true
  }

  return permitted;
}
