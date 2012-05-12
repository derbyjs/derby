var racer = require('racer')
  , derby = module.exports = Object.create(racer)
  , derbyPlugin = racer.util.isServer ?
      __dirname + '/derby.server' : require('./derby.browser');

racer._makePlugable('derby', derby);
derby.use(derbyPlugin);
