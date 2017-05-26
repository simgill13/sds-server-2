const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const {BasicStrategy} = require('passport-http');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const proxy = require('http-proxy-middleware');
const Expo = require('exponent-server-sdk');
const { DATABASE_URL, PORT } = require('./config');
const User = require('./models/user-model');
mongoose.Promise = global.Promise;

const app = express();
app.use(morgan('common'));
app.use(bodyParser.json());

const socketApp = express();
const socketIO = require('socket.io');

// Routes
const friends = require('./routes/friends');
const rooms = require('./routes/room');
const search = require('./routes/search');

rooms(app);
friends(app);
search(app);

var mongojs = require('mongojs');

var ObjectID = mongojs.ObjectID;
var db = mongojs(process.env.MONGO_URL || 'mongodb://terry:terrypass@ds137749.mlab.com:37749/sds');

// Mapping objects to easily map sockets and users.
var clients = {};
var users = {};

// This represents a unique chatroom.
// For this example purpose, there is only one chatroom;
// var chatId = 1;

// new room increment chatId

// Event listeners.
// When a user joins the chatroom.
function onUserJoined(userId, chatId, socket) {
  console.log('User Joined');
  try {
    // The userId is null for new users.
    if (!userId) {
      var user = db.collection('users').insert({}, (err, user) => {
        socket.emit('userJoined', user._id);
        users[socket.id] = user._id;
        _sendExistingMessages(socket, chatId);
      });
    } else {
      users[socket.id] = userId;
      _sendExistingMessages(socket, chatId);
    }
  } catch(err) {
    console.error(err);
  }
}

// When a user sends a message in the chatroom.
function onMessageReceived(message, chatId, senderSocket) {
  console.log('User Message Received');
  var userId = users[senderSocket.id];
  // Safety check.
  if (!userId) return;
  _sendAndSaveMessage(message, chatId, senderSocket);
}

// Helper functions.
// Send the pre-existing messages to the user that just joined.
function _sendExistingMessages(socket, chatId) {
  console.log('Send Existing Messages');
  var messages = db.collection('messages')
    .find({ chatId })
    .sort({ createdAt: 1 })
    .toArray((err, messages) => {
      // If there aren't any messages, then return.
      if (!messages.length) return;
      socket.emit('message', messages.reverse());
  });
}

// Save the message to the db and send all sockets but the sender.
function _sendAndSaveMessage(message, chatId, socket, fromServer) {
  console.log('Send and Save Message');
  var messageData = {
    text: message.text,
    user: message.user,
    createdAt: new Date(message.createdAt),
    chatId: chatId,
    image: message.image
  };
  db.collection('messages').insert(messageData, (err, message) => {
    // If the message is from the server, then send to everyone.
    var emitter = fromServer ? websocket : socket.broadcast;
    emitter.emit('message', [message]);
  });
}

// Allow the server to participate in the chatroom through stdin.
var stdin = process.openStdin();
stdin.addListener('data', function(d) {
  _sendAndSaveMessage({
    text: d.toString().trim(),
    createdAt: new Date(),
    user: { _id: 'robot' }
  }, null /* no socket */, true /* send from server */);
});

//////////////////////////////////////////////

const basicStrategy = new BasicStrategy(
  (email, password, callback) => {
    let user;
    User
      .findOne({email})
      .exec()
      .then(_user => {
        user = _user;
        if (!user) {
          return callback(null, false, "Incorrect Email");
        }
        return user.validatePassword(password);
      })
      .then(isValid => {
        if (!isValid) {
          return callback(null, false, "Incorrect password");
        }
        else {
          return callback(null, user);
        }
      });
});

passport.use(basicStrategy);
app.use(passport.initialize());

app.get('/api/users/:userEmail', passport.authenticate('basic', {session: false}), (req, res) => {
  userEmail = req.params.userEmail.toLowerCase();
  User
    .findOne({ email: userEmail })
    .then(user => {
      if (!user) {
        return res.status(404).json({message: 'Email not found in database'});
      } else {
        return res.status(200).json(user.apiRepr());
      }
    })
    .catch(err => {
      res.status(500).json({message: 'Internal server error'})
    });
})

app.post('/api/users', (req, res) => {
  if (!req.body) {
    return res.status(400).json({message: 'No request body'});
  }

  if (!("name" in req.body)) {
    return res.status(422).json({message: 'Missing field: name'});
  }

  let {email, password, name, token} = req.body;

  email = email.trim().toLowerCase();
  name = name.trim();
  password = password.trim();

  if (typeof name !== 'string') {
    return res.status(422).json({message: 'Empty field type: name'});
  }

  if (name === '') {
    return res.status(422).json({message: 'Empty field length: name'});
  }

  if (email === '') {
    return res.status(422).json({message: 'Empty field length: email'})
  }

  if (!(password)) {
    return res.status(422).json({message: 'Missing field: password'});
  }

  if (typeof password !== 'string') {
    return res.status(422).json({message: 'Incorrect field type: password'});
  }

  if (password === '') {
    return res.status(422).json({message: 'Incorrect field length: password'});
  }

  // check for existing user with same email before creating...
  return User
    .find({email})
    .count()
    .then(count => {
      if (count > 0) {
        return res.status(422).json({message: 'email already taken'});
      }
      return User.hashPassword(password);
    })
    .then(hash => {
      return User
        .create({
          name: name,
          password: hash,
          email: email,
          deviceToken: token,
        })
    })
    .then(user => {
      return res.status(201).json(user.apiRepr());
    })
    .catch(err => {
      res.status(500).json({message: 'Internal server error'})
    });
})

app.delete('/api/users/:userEmail', passport.authenticate('basic', {session: false}), (req, res) => {
  userEmail = req.params.userEmail.toLowerCase();
  User
    .findOneAndRemove({email: userEmail}, (err, user) => {
      if (err) {
        throw err;
      }
      if (user) {
        res.status(200).json({message: 'User found and deleted', user: user});
      }
      else {
        res.status(500).json({message: 'No user found'});
      }
    })
})

let expo = new Expo();

async function sendNotification(deviceId, message) {
  try {
    let receipts = await expo.sendPushNotificationsAsync([{
      // The push token for the app user to whom you want to send the notification
      to: deviceId,
      sound: 'default',
      body: message,
      data: {withSome: 'data'},
    }]);
    return receipts;
  } catch (error) {
    console.error(error);
  }
};

app.post('/api/notification', (req, res) => {
  return sendNotification(req.body.deviceId, req.body.message)
  .then(receipts => {
    res.status(201).json({message: receipts});
  })
})

// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
let server;
let websocket;

// this function connects to our database, then starts the server
function runServer(databaseUrl=DATABASE_URL, port=PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
      .on('error', err => {
        mongoose.disconnect();
        reject(err);
      });
    })
    .then(() => {
      websocket = socketIO(server);

      websocket.on('connection', (socket, chatId) => {
          console.log('user connected');
          clients[socket.id] = socket;
          // Client Side to emit to specific room?
          // io.emit('room', {room_name : 'test'});

          // Server Side to join specific room?
          // socket.on('room', function(data){
          //   socket.join(data.room_name)
          // })

          // Client side emit in specific room only
          // io.sockets.in(room).emit('event', data);

          // Client side creating a room
          // var socket = io.connect();
          // socket.emit('create', 'room1');

          // Creating a specific room and joining it
          // socket.on('create', function (room) {
          //   socket.join(room);
          // })
          socket.on('userJoined', (userId, chatId) => onUserJoined(userId, chatId, socket));
          socket.on('message', (message, chatId) => onMessageReceived(message, chatId, socket));
      });
    })
  });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
  return mongoose.disconnect().then(() => {
     return new Promise((resolve, reject) => {
       console.log('Closing server');
       server.close(err => {
           if (err) {
               return reject(err);
           }
           resolve();
       });
     });
  });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
  runServer().catch(err => console.error(err));
};

module.exports = {runServer, app, closeServer};
