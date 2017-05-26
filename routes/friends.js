const User = require('../models/user-model');

module.exports = function(app) {
  app.get('/api/:id/friends', (req, res) => {
    User
    .findById(req.params.id)
    .then(user => {
      console.log(user);
      res.status(200).json(user.friendsList);
    })
    .catch(error => {
      res.status(500).json({error: 'Internal Server Error'});
    })
  });

  // add friend to user
  app.post('/api/:id/friends/:friend_id', (req, res) => {
    User
    .findById(req.params.friend_id)
    .then(user => {
      console.log(user);
      return User
      .findByIdAndUpdate(req.params.id,
        {$push: {friendsList: user }},
        {new: true});
    })
    .then(updatedUser => {
      console.log(updatedUser);
      res.status(200).json(updatedUser)
    })
    .catch(error => {
      res.status(500).json({error: 'Internal Server Error'});
    })
  });

  // should be a put...
  // remove friend from user
  app.delete('/api/:id/friends/:friend_id', (req, res) => {
    User
    .findById(req.params.id)
    .then(user => {
      return user.friendsList.filter(friend => {
        return (friend._id != req.params.friend_id)
      })
    })
    .then(newFriendList => {
      return User.findByIdAndUpdate(
        req.params.id,
        { $set: { friendsList: newFriendList }},
        { new: true }
      )
    })
    .then(user => {
      res.status(200).json(user);
    })
    .catch(error => {
      res.status(500).json({error: 'Internal Server Error'});
    })
  });
};
