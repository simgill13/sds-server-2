const Room = require('../models/room-model');
const User = require('../models/user-model');

module.exports = function(app) {
  // Create a new room with the current User being added to rooms users.
  app.post('/api/:id/room', (req, res) => {
    let currentUserId = req.params.id
    User
    .find({_id: currentUserId})
    .then(user => {
      if (user === null) {
        return Room
        .create({
          roomName: req.body.roomName,
          users: req.body.addedFriends,
          messages: [],
        });
      } else {
        return Room
        .create({
          roomName: req.body.roomName,
          users: [user].concat(req.body.addedFriends),
          messages: [],
        });
      }
    })
    .then(room => {
      return User // updating current User,
      .findByIdAndUpdate(
        currentUserId,
        { $push: {rooms: room }},
        {new: true}
      )
    })
    .then(user => {
      res.status(200).json(user.apiRepr());
    })
    .catch(error => {
      res.status(500).json({message: 'Internal Server Error'});
    })
  });

  // users = { // user1, user2,
  //   rooms: [{room1}, {room2}, {room3}]
  // }
  //
  // room1 = {
  //   id: asdfasdfa,
  //   users: [{james}, {sim}]
  // }

  // // console.log(room)
  // let artificialUser = [{
  //   _id: req.params.id
  // }]
  // let addRoom = req.body.addedFriends.concat(artificialUser);
  // const idArray = addRoom.map((user) => {
  //   return user._id;
  // })
  // console.log(idArray);
  // // console.log(addRoom);
  // idArray.forEach((id) => {
  //   console.log('I made it', id);
  //   User.findOneAndUpdate(id, {$push: {rooms: room}});
  // })
  //   // return User
  //   // .Update(
  //   //   { _id: { "$in": idArray }},
  //   //   { $push: {rooms: room }},
  //   //   { multi: true }
  //   // )
  // return room;

  // grab all rooms
  app.get('/api/rooms', (req, res) => {
    Room
    .find({})
    .then(rooms => {
      res.status(200).json(rooms);
    })
  });

  // grab specific room by id
  app.get('/api/room/:id', (req, res) => {
    Room
    .findById(req.params.id)
    .then(room => {
      res.status(200).json(room.apiRepr());
    })
    .catch(error => {
      res.status(500).json({message: 'Internal server error'});
    });
  });

  // delete room
  // need to find each user id and remove from their room array.
  app.delete('/api/room/:id', (req, res) => {
    Room
    .findById(req.params.id)
    .then(room => {
      deleteUserRooms(room.users, req.params.id);
      Room
      .findOneAndRemove({_id: req.params.id}, (err, room) => {
        if (err) {
          throw err;
        }
        if (room) {
          res.status(200).json({message: 'Room found and deleted', room: room})
        } else {
          res.status(500).json({message: 'No room found'});
        }
      });
    })
  });

  // takes a rooms users array as an argument.
  function deleteUserRooms(userArray, roomId) {
    userArray.map(user => {
      User
      .findOneAndRemove(
        {_id: user._id},
        { $pull: { rooms: { _id: roomId }}}
      )
      .then(user => {
        return user;
      })
      .catch(error => {
        res.status(500).json({message:  'No Users'})
      })
    })
  }

  // add user to a specific room
  // and add room to the specified user
  app.post('/api/room/:id/add', (req, res) => {
    console.log('hello');
    console.log(req.params.id);
    console.log(req.body.currentUserId);
    let currentUserId = req.body.currentUserId
    User
    .findById(currentUserId)
    .then(user => {
      console.log(user);
      return Room
      .findByIdAndUpdate(
        req.params.id,
        {$push: {users: user}},
        {new: true}
      );
    })
    .then(updatedRoom => {
      console.log('updated Room', updatedRoom);
      return User
      .findByIdAndUpdate(
        currentUserId,
        { $push: {rooms: updatedRoom }},
        { new: true }
      )
    })
    .then(updatedUser => {
      res.status(200).json(updatedUser.apiRepr());
    })
    .catch(error => {
      console.log(error);
      res.status(500).json({error: 'Internal Server Error'});
    });
  });

    // remove user from a specific room
    // also removes room from user room array.
  function updateUser(userId, roomId) {
    console.log('user id and room id', userId, roomId)
    return User
    .findById(userId)
    .then(user => {
      console.log('inside updateUser function', user)
      return user.rooms.filter(room => {
        return (String(room._id) !== String(roomId))
      })
    })
    .then(newRoomList => {
      return User.findByIdAndUpdate(
        userId,
        { $set: { rooms: newRoomList }},
        { new: true }
      );
    });
  }

  app.put('/api/room/:id/remove', (req, res) => {
    const userId = req.body.userId;
    Room
    .findById(req.params.id)
    .then(room => {
      return room.users.filter(user => {
        return (user._id != userId)
      })
    })
    .then(newUserList => {
      console.log(newUserList)
      return Room.findByIdAndUpdate(
        req.params.id,
        { $set: { users: newUserList }},
        { new: true }
      )
    })
    .then(room => {
      updateUser(userId, room._id);
      res.status(200).json(room.apiRepr());
    })
    .catch(error => {
      res.status(500).json({error: 'Internal Server Error'});
    });
  });

};
