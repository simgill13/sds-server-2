const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const userSchema = mongoose.Schema({
  name: {type: String, required: true},
  email: {type: String, required: true},
  password: {type: String, required: true},
  friendsList: {type: Array, default: []},
  deviceToken: {type: String, default: ''},
  rooms: {type: Array, default: []} /// [room 1, room 2, room 3]
});

userSchema.methods.apiRepr = function() {
  return {
    name: this.name,
    email: this.email,
    friendsList: this.friendsList,
    id: this._id,
    deviceToken: this.deviceToken,
    rooms: this.rooms
  };
};

userSchema.methods.validatePassword = function(password) {
  return bcrypt.compare(password, this.password);
}

userSchema.statics.hashPassword = function(password) {
  return bcrypt.hash(password, 12);
}

module.exports = mongoose.model('User', userSchema)
