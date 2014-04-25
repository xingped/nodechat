/* 
  Module dependencies:
  
  - Express
  - Http (to run Express)
  
  It is a common practice to name the variables after the module name.
  Ex: http is the "http" module, express is the "express" module, etc.
  The only exception is Underscore, where we use, conveniently, an underscore.
  Oh, and "socket.io" is simply called io.
  Seriously, the rest should be named after its module name.

*/
var express = require("express")
  , app = express()
  , http = require("http").createServer(app)
  , io = require("socket.io").listen(http)
  , _ = require("underscore");

/* 
  The list participants.
  The format of each participant will be:
    participant
    {
      id: "sessionId",
      name: "participantName"
      channel: "channelName"
    }
  }
*/
var participants = [];

/* Server config */

//Server's IP address
app.set("ipaddr", "192.168.1.13");

//Server's port number 
app.set("port", 8080);

//Specify the views folder
app.set("views", __dirname + "/views");

//View engine is Jade
app.set("view engine", "jade");

//Specify where the static content is
app.use(express.static("public", __dirname + "/public"));

//Tells server to support JSON, urlencoded, and multipart requests
app.use(express.bodyParser());

/* Server routing */

//Handle route "GET /", as in "http://localhost:8080/"
app.get("/", function(request, response) {

  //Render the view called "index"
  response.render("index");

});

//POST method to create a chat message
app.post("/message", function(request, response) {

  //The request body expects a param named "message"
  var message = request.body.message;

  //If the message is empty or wasn't sent it's a bad request
  if(_.isUndefined(message) || _.isEmpty(message.trim())) {
    return response.json(400, {error: "Message is invalid"});
  }

  //We also expect the sender's name with the message
  var name = request.body.name;
  var channel = request.body.channel;

  //Let our chatroom know there was a new message
  io.sockets.in(channel).emit("incomingMessage", {message: message, name: name});

  //Looks good, let the client know
  response.json(200, {message: "Message received"});

});

/* Socket.IO events */
io.on("connection", function(socket){
  
  /*
    When a new user connects to our server, we expect an event called "newUser"
    and then we'll emit an event called "newConnection" with a list of all 
    participants to all connected clients
  */
  socket.on("newUser", function(data) {
    socket.join(data.channel);
    participants.push({id: data.id, name: data.name, channel: data.channel});
    io.sockets.in(data.channel).emit("newConnection", {participants: _.where(participants, {channel: data.channel})});
  });

  /*
    When a user changes his name, we are expecting an event called "nameChange" 
    and then we'll emit an event called "nameChanged" to all participants with
    the id and new name of the user who emitted the original message
  */
  socket.on("nameChange", function(data) {
    _.findWhere(participants, {id: socket.id}).name = data.name;
    io.sockets.in(data.channel).emit("nameChanged", {id: data.id, name: data.name});
  });

  /*
    Leave current socket channel, change user's channel, change socket channel.
    Fire events to update participants list of both old and new channels.
  */
  socket.on("channelChange", function(data) {
    var oldChannel = _.findWhere(participants, {id: socket.id}).channel;
    var newChannel = data.channel;

    socket.leave(oldChannel);
    _.findWhere(participants, {id: socket.id}).channel = data.channel;
    socket.join(newChannel);

    io.sockets.in(oldChannel).emit("userDisconnected", {id: socket.id, sender:"system"});
    io.sockets.in(newChannel).emit("channelChanged", {participants: _.where(participants, {channel: data.channel})});
  });

  /* 
    When a client disconnects from the server, the event "disconnect" is automatically 
    captured by the server. It will then emit an event called "userDisconnected" to 
    all participants with the id of the client that disconnected
  */
  socket.on("disconnect", function() {
    var channel = _.findWhere(participants, {id: socket.id}).channel;
    participants = _.without(participants,_.findWhere(participants, {id: socket.id}));
    io.sockets.in(channel).emit("userDisconnected", {id: socket.id, sender:"system"});
  });

});


//Start the http server at port and IP defined before
http.listen(app.get("port"), app.get("ipaddr"), function() {
  console.log("Server up and running. Go to http://" + app.get("ipaddr") + ":" + app.get("port"));
});
