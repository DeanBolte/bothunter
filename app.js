const Discord = require("discord.js");
const ytdl = require('ytdl-core');
require('dotenv').config();

const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

const {
	AudioPlayerStatus,
	StreamType,
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
} = require('@discordjs/voice');

const {
	prefix
} = require('./config.json');

let playing = false;

client.on("ready", () => {
  console.log('Bot is online');
});

client.on("messageCreate", msg => {
  const songQueue = queue.get(msg.guild.id);

  if(msg.content.startsWith(prefix)) {
    if (msg.content.startsWith(`${prefix}play`)
    || msg.content.startsWith(`${prefix}p`)) {
        play(msg);
        return;
    } else {
        msg.channel.send("Invalid Command!");
    }
  }
});

client.login(process.env.TOKEN);

// check if user is in vc and has permissions
async function play(message) {
  const args = message.content.split(" ");
  const voiceChannel = message.member.voice.channel;

  const connection = joinVoiceChannel({
	channelId: voiceChannel.id,
	guildId: voiceChannel.guild.id,
	adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
  };

  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
  const player = createAudioPlayer();

  player.play(resource);
  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    connection.destroy();
  });
}
