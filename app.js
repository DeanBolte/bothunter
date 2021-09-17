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
const queue = new Map();

client.on("ready", () => {
  console.log('Bot is online');
});

client.on("messageCreate", msg => {
  const songQueue = queue.get(msg.guild.id);

  if(msg.content.startsWith(prefix)) {
    if (msg.content.startsWith(`${prefix}play`)
    || msg.content.startsWith(`${prefix}p`)) {
        play(msg, songQueue);
        return;
    } else {
        msg.channel.send("Invalid Command!");
    }
  }
});

client.login(process.env.TOKEN);

async function play(message, songQueue) {
  // get user input
  const args = message.content.split(" ");
  const voiceChannel = message.member.voice.channel;

  // check if user is in vc and has permissions
  if (!voiceChannel)
    return message.channel.send(
      "Please be in a vc so that i can play music."
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I am missing permissions to join the vc."
    );
  }

  // connect to voice channel
  const connection = joinVoiceChannel({
	channelId: voiceChannel.id,
	guildId: voiceChannel.guild.id,
	adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  // grab song info from YouTube
  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
  };

  // create resources for music player
  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
  const player = createAudioPlayer();

  // start playing the song and connect to the output
  player.play(resource);
  connection.subscribe(player);

  // on music ending
  player.on(AudioPlayerStatus.Idle, () => {
    connection.destroy();
  });
}
