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

const queue = new Map();

client.on("ready", () => {
  console.log('Bot is online');
});

client.on("messageCreate", msg => {
  const songQueue = queue.get(msg.guild.id);

  if(msg.content.startsWith(prefix)) {
    if (msg.content.startsWith(`${prefix}play`)
    || msg.content.startsWith(`${prefix}p`)) {
      handleSong(msg, songQueue);
      return;
    } else if (msg.content.startsWith(`${prefix}next`)
    || msg.content.startsWith(`${prefix}n`)) {
      next(msg, songQueue);
      return;
    } else if (msg.content.startsWith(`${prefix}stop`)
    || msg.content.startsWith(`${prefix}s`)) {
      next(msg, songQueue);
      return;
    } else if (msg.content.startsWith(`${prefix}pause`)
    || msg.content.startsWith(`${prefix}p`)) {
      next(msg, songQueue);
      return;
    } else if (msg.content.startsWith(`${prefix}help`)) {
      sendHelp(msg);
      return;
    } 
  }
});

client.login(process.env.TOKEN);

async function handleSong(message, songQueue) {
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

  // add song to queue or start playing
  if (!songQueue) {
    // Creating the contract for our queue
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };
    // Setting the queue using our contract
    queue.set(message.guild.id, queueContruct);
    // Pushing the song to our songs array
    queueContruct.songs.push(song);
    
    // save our connection into our object.
    queueContruct.connection = connection;
    // Calling the play function to start a song
    play(message.guild, queueContruct.songs[0]);
  }else {
    songQueue.songs.push(song);
   console.log(songQueue.songs);
   return message.channel.send(`${song.title} has been added to the queue!`);
  }
}

function play(guild, song) {
  // get queue
  const songQueue = queue.get(guild.id);

  // leave if there is no song to play
  if (!song) {
    songQueue.voiceChannel.leave();
    songQueue.connection.destroy();
    queue.delete(guild.id);
    return;
  }

  // create resources for music player
  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
  const player = createAudioPlayer();

  // start playing the song and connect to the output
  player.play(resource);
  songQueue.connection.subscribe(player)
  songQueue.textChannel.send(`Start playing: **${song.title}**`);

  // on music ending
  player.on(AudioPlayerStatus.Idle, () => {
    songQueue.songs.shift();
    play(guild, songQueue.songs[0]);
  });
}

function next(message, songQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!songQueue) {
    return message.channel.send("There is no song that I could skip!");
  }
  songQueue.songs.shift();
  play(message.guild, songQueue.songs[0]);
}

function sendHelp(message) {
  message.channel.send(
    "Here is a list of working commands: \n" +
    "play (p) [youtube url]: plays or queues a song \n" +
    "next (n): skips the current song \n"
  )
}