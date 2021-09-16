const Discord = require("discord.js");
const ytdl = require('ytdl-core');
require('dotenv').config();
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });
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
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }

  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
  };

  if (!serverQueue) {
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

    try {
      // Here we try to join the voicechat and save our connection into our object.
      const connection = await joinVoiceChannel({
         channelId: voiceChannel.id,
         guildId: voiceChannel.guild.id,
         adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });
       queueContruct.connection = connection;
       // Calling the play function to start a song
       play(message.guild, queueContruct.songs[0]);
    } catch (err) {
       // Printing the error message if the bot fails to join the voicechat
       console.log(err);
       queue.delete(message.guild.id);
       return message.channel.send(err);
    }
  }else {
     serverQueue.songs.push(song);
     console.log(serverQueue.songs);
     return message.channel.send(`${song.title} has been added to the queue!`);
  }
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .playStream(ytdl(song.url))
    .on("end", () => {
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
