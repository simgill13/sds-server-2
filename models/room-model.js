const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const roomSchema = mongoose.Schema({
  roomName: {type: String, required: true},
  users: {type: Array, default: []}, // [ {user obj}, user obj]
  messages: {type: Array, default: []},
});

roomSchema.methods.apiRepr = function() {
  return {
    roomName: this.roomName,
    users: this.users,
    messages: this.messages,
    id: this._id
  };
};

module.exports = mongoose.model('Room', roomSchema)
