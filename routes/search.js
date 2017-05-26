const User = require('../models/user-model');

// Very restrictive email has to be exact right now
module.exports = function(app) {
  app.post('/api/search', (req, res) => {
    const email = req.body.email;
    if (email) {
      User
      .find({email:{
        $regex: new RegExp(email, "i")
      },function(err, doc) {
        cb(doc);
      }
    })
      .limit(20)
      .then(users => {
        res.status(200).json(users);
      })
      .catch(error => {
        res.status(500).json({error: 'Internal Server Error'});
      })
    } else {
      User
      .find()
      .limit(20)
      .then(users => {
        res.status(200).json(users);
      })
      .catch(error => {
        res.status(500).json({error: 'Internal Server Error'});
      })
    }
  })
};
