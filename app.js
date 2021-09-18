const Discord = require("discord.js");
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const {
  AudioPlayerStatus,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');

require('dotenv').config();
const { prefix } = require('./config.json');

// set up youtube api using the API KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YOUTUBE_API_KEY) {
  throw new Error("No API key is provided");
}
const {google} = require("googleapis");
const youtube = google.youtube({
  version: 'v3',
  auth: YOUTUBE_API_KEY
});

// represents the queue of songs
const queue = new Map();

client.on("ready", () => {
  console.log('Bot is online');
});

client.on("messageCreate", msg => {
  const songQueue = queue.get(msg.guild.id);

  if (msg.content.startsWith(prefix)) {
    if (msg.content.startsWith(`${prefix}play`)
      || msg.content.startsWith(`${prefix}p`)) {
      if(msg.content.search(" ") >= 0) {
        handleSong(msg, songQueue);
      } else {
        msg.channel.send("Please add a url or search term after the play command.")
      }
      return;
    } else if (msg.content.startsWith(`${prefix}next`)
      || msg.content.startsWith(`${prefix}n`)) {
      next(msg, songQueue);
      return;
    } else if (msg.content.startsWith(`${prefix}stop`)) {
      stop(msg, songQueue);
      return;
    } else if (msg.content.startsWith(`${prefix}song`)) {
      showSong(msg, songQueue);
      return;
    } else if (msg.content.startsWith(`${prefix}help`)) {
      sendHelp(msg);
      return;
    }
  }
});

client.login(process.env.TOKEN);

async function handleSong(message, songQueue) {
  // read user input
  const args = message.content.split(" ");
  const searchParam = message.content.substr(message.content.search(" "));
  console.log("searching for: " + searchParam + "...\n");
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

  // get the url for the video via the youtube api
  let url = null;
  try {
    const response = await youtube.search.list({
      "part": [
        "snippet"
      ],
      "maxResults": 1,
      "q": searchParam,
      "safeSearch": "none"
    });
    const raw = response.data.items[0].snippet.thumbnails.default.url;
    const data = raw.substring(raw.search("/vi/") + 4, raw.search("/default"));
    url = "https://www.youtube.com/watch?v=" + data;
  } catch(err) {
    console.log(err);
    return;
  }
  console.log("Found: " + url + "\n");

  // use ytdl to get info on the youtube video
  const songInfo = await ytdl.getInfo(url);
  const song = {
    title: songInfo.videoDetails.title,
    author: songInfo.videoDetails.author.name,
    url: songInfo.videoDetails.video_url,
    length: songInfo.videoDetails.lengthSeconds,
    views: songInfo.videoDetails.viewCount,
    description: songInfo.videoDetails.description,
  };

  // add song to queue or start playing
  if (!songQueue) {
    // represents the data for a guild contract
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      current: null,
      songs: [],
    };
    // adding the queue contract to the queue map
    queue.set(message.guild.id, queueContruct);
    // add song to queue
    queueContruct.songs.push(song);

    try {
      // attempt to join voice channel
      queueContruct.connection = await joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      // play the first song in the queue
      play(message.guild, queueContruct.songs[0]);
    } catch(err) {
      console.log(err);
      queue.delete(message.guild.id);
      return;
    }
  } else {
    // if there is already a song playing then queue the song
    songQueue.songs.push(song);
    return message.channel.send(`Now queueing: **${song.title}**`);
  }
}

function play(guild, song) {
  // recursive exit requirement
  if(!song) {
    // leave if there is no song to play
    songQueue.connection.destroy();
    queue.delete(guild.id);
  }
  
  // get queue
  const songQueue = queue.get(guild.id);

  // create resources for music player
  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
  const player = createAudioPlayer();

  // save current song resource to queue data
  songQueue.current = resource

  // start playing the song in the voice channel
  try {
    player.play(resource);
    songQueue.connection.subscribe(player)
    songQueue.textChannel.send(`Now playing: **${song.title}**`);
  } catch (err) {
    console.log(err);
    throw err
  }

  // on music ending
  player.on(AudioPlayerStatus.Idle, () => {
    songQueue.songs.shift();
    play(guild, songQueue.songs[0]);
  });
}

// skip to next song in queue
function next(message, songQueue) {
  if (!songQueue) {
    return message.channel.send("There is nothing in the queue.");
  }
  songQueue.songs.shift();
  play(message.guild, songQueue.songs[0]);
}

// end queue contract
function stop(message, songQueue) {
  message.channel.send("Ending music session...");
  songQueue.connection.destroy();
  queue.delete(message.guild.id);
}

// show current song
function showSong(message, songQueue) {
  if (!songQueue) {
    return message.channel.send("There is nothing in the queue.");
  }
  // get time info
  let elapsed = secondsToTimeString(songQueue.current.playbackDuration * 0.001);
  let duration = secondsToTimeString(songQueue.songs[0].length);

  // get video info
  let description = songQueue.songs[0].description;
  let author = songQueue.songs[0].author;
  let views = songQueue.songs[0].views;

  message.channel.send(
    `Currently playing: **${songQueue.songs[0].title}**\n` +
    `${elapsed} / ${duration}\n\n` +
    `Author: ${author}\n` +
    `Views: ${views}\n` +
    `*Description:*\n ${description}\n`    
  );
}

function secondsToTimeString(time) {
  // break time into component parts
  let hours = Math.floor(time / 3600);
  let minutes = Math.floor((time / 60) % 60);
  let seconds = Math.floor(time - (hours * 3600) - (minutes * 60));

  // add 0 to numbers if not two digits wide
  if (hours   < 10) {hours   = "0"+hours;}
  if (minutes < 10) {minutes = "0"+minutes;}
  if (seconds < 10) {seconds = "0"+seconds;}
  return (hours+":"+minutes+":"+seconds);
}

function sendHelp(message) {
  message.channel.send(
    "Here is a list of working commands (use . as a prefix): \n" +
    "**play (p) [youtube url]:** plays or queues a song. \n" +
    "**next (n):** skips the current song. \n" +
    "**stop:** stops the music. \n" +
    "**song:** shows some info on the current song. \n" +
    "**help:** list of working commands."
  );
}