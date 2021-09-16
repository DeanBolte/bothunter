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

const queue = new Map();

const {
	prefix
} = require('./config.json');

client.on("ready", () => {
  console.log('Bot is ready');
});

client.on("message", msg => {
  if (msg.content.search("@everyone") >= 0) {
    if(!isPermitted(msg.member)) {
      msg.reply("no.");
    }
  }

  if(msg.content.startsWith(prefix)) {
    const serverQueue = queue.get(msg.guild.id);

    if (msg.content.startsWith(`${prefix}play`)) {
        execute(msg, serverQueue);
        return;
    } else if (msg.content.startsWith(`${prefix}skip`)) {
        skip(msg, serverQueue);
        return;
    } else if (msg.content.startsWith(`${prefix}stop`)) {
        stop(msg, serverQueue);
        return;
    } else {
        msg.channel.send("Invalid Command!");
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

// check if user is in vc and has permissions
async function execute(message, serverQueue) {
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

  player.on(AudioPlayerStatus.Idle, () => connection.destroy());
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .playFile(ytdl(song.url))
    .on("finish", () => {
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could skip!");
  serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );

  if (!serverQueue)
    return message.channel.send("There is no song that I could stop!");

  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}
