// NICKSTUDIOS
// - AntarcticRuler

const Discord = require("discord.js");
const assert = require ('assert');

var client = new Discord.Client();

var config = require ('./config.json');

const token = config.token;

const MongoClient = require("mongodb").MongoClient;

const express = require('express')
const app = express()
const port = 3000
app.use(express.json());

const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

var DiscordStrategy = require('passport-discord').Strategy;
var passport = require('passport');

var a_token;

var server_reactions;

passport.use(new DiscordStrategy(
  {
    clientID: '688388524528893955',
    clientSecret: config.o2auth_secret,
    callbackURL: `http://www.nick-studios.com/rxns/auth/callback`,
    scope: ["identify", "guilds"],
  },
  function(accessToken, refreshToken, profile, cb) {
  
    let data = []; // the data for all the partial guilds
    let rxnsExisting = []; // the already existing servers

    a_token = accessToken; // the access token
    // gets all the users guilds
    oauth.getUserGuilds(accessToken).then(guilds => { 
      // loops through all the users guilds
      guilds.forEach(element => {
        // sees if the user owns the guild
        if (element.owner) {
          data.push(element);
          collection.findOne ( { id : element.id }, function(err, res) { rxnsExisting.push(res) } ) // pushes the already existing reactions
        }
        
      })
      // Creates the routes for data and rxnsExisting
      app.get('/rxns/data', function (req, res) {
        res.json(data)
        res.end();
      })     
      app.get('/rxns/rxnsExisting', function (req, res) {
        res.json(rxnsExisting)
        res.end();
      }) 
      // Adds a reaction to a server
      app.post ('/rxns/add', function (req, res) {
        console.log (req.body);
        addOne(req.body.server, req.body.name, req.body.url);
      })
      // The route to retreive server_reactions
      app.get('/rxns/server_reactions', function (req, res) {
        res.json(server_reactions)
        res.end();
      })     
      // return callback
      return cb();
    });
  })
);

// Authenticates them
app.get('/rxns/auth', passport.authenticate('discord'));

// The callbeck for the authentication
app.get('/rxns/auth/callback', passport.authenticate('discord', {
  failureRedirect: `http://www.nick-studios.com/rxns?token=${a_token}`
}), function(req, res) {
  res.redirect(`http://www.nick-studios.com/rxns?token=${a_token}`) // Successful auth
  res.end();
});

const url = config.uri;
const dbClient = new MongoClient(url, { useUnifiedTopology: true });

var db;
var collection;

// READY
client.on("ready", () => {
  console.log("BOT ON");
  dbClient.connect(function(err) {
    assert.equal(null, err);
    console.log("DB ACTIVE");

    db = dbClient.db("Reactions");
    
    collection = db.collection("reactions");

    client.user.setActivity(`*help`);

    app.listen(port, (req,res) => { 
      console.log(`Example app listening on port ${port}!`)
    })

    collection.find ({}).toArray(function(err, res) {
      server_reactions = res;
    });

  });
});

// GUILD CREATE
client.on ("guildCreate", guild => {

  console.log ("ADDING")

  // Creates the GUILD value
  let server = {
    id: guild.id,
    reactions: new Map()
  }

  // Inserts the guild
  collection.insertOne(server, function(err, res) {
      if (err) throw err;
      console.log(guild.name + " ADDED");

      collection.find ({}).toArray(function(err, res) {
        server_reactions = res;
      });

  });

});

// Adds a reaction to a server
function addOne (serverID, name, url) {

  console.log (serverID);

  // Finds the server to add the reaction to
  collection.find( { id: serverID.toString() }).toArray(function(err, res) {
    if (err) throw err;
    // Inserts the guild

    // Adds the reaction
    res[0].reactions[name] = url

    // Updates the server on the DB
    collection.updateOne( { id: serverID } , { $set: { reactions: res[0].reactions } } , function(err, res) {
        if (err) throw err;

        // Updates the server_reactions on the server
        collection.find ({}).toArray(function(err, res) {
          server_reactions = res;
        });
    });
  });

}

// GUILD DELETE
client.on ("guildDelete", guild => {
  // Deletes the guild when the bot leaves
  collection.deleteOne ({ id: guild.id }, function(err, res) {
    if (err) throw err;
    console.log(guild.name + " DELETED");
  });
});

// MESSAGE
const prefix = "*";
client.on("message", message => {
  if (message.author.bot) return;

  // Variables
  let msg = message.content.toLowerCase();

  if (msg.startsWith(`${prefix}help`)) {
    message.channel.send (new Discord.RichEmbed().setDescription(`http://www.nick-studios.com/rxns/auth`));
  }

  // Changes the bot's username
  if (msg.startsWith(`${prefix}nick`) || msg.startsWith(`${prefix}nickname`)) {
    if (message.member.permissions.has('MANAGE_NICKNAMES') && message.guild.member(client.user.id).hasPermission('CHANGE_NICKNAME')) {
      message.guild.member(client.user.id).setNickname(message.content.slice(msg.split(' ')[0].length));
      message.channel.send (new Discord.RichEmbed().setDescription('Username Changed'))
    }
    else if (!message.member.hasPermission('MANAGE_NICKNAMES'))
      message.channel.send (new Discord.RichEmbed().setDescription('You do not have manage nicknames permission'))
    else
      message.channel.send (new Discord.RichEmbed().setDescription('Error: The bot may not have nickname changing permissions'))
  }

  server_reactions.forEach ( server => {
    if (server.id == message.guild.id)
      Object.entries(server.reactions).forEach ( reaction => {
        if (msg.includes (reaction[0]))
          message.channel.send (reaction[1]);
      })
  })

});

client.login(token);