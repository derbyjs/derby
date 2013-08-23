var express = require('express');
var derby = require('derby');
var racerBrowserChannel = require('racer-browserchannel');
var liveDbMongo = require('livedb-mongo');
var MongoStore = require('connect-mongo')(express);
var $$app$$ = require('../$$app$$');
var error = require('./error');

var expressApp = module.exports = express();

var mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/project';
var store = derby.createStore({
  db: liveDbMongo(mongoUrl + '?auto_reconnect', {safe: true})
, redis: require('redis').createClient()
});

function createUserId(req, res, next) {
  var model = req.getModel();
  var userId = req.session.userId || (req.session.userId = model.id());
  model.set('_session.userId', userId);
  next();
}

expressApp
  .use(express.favicon())
  // Gzip dynamically
  .use(express.compress())
  // Respond to requests for application script bundles
  .use($$app$$.scripts(store))
  // Serve static files from the public directory
  // .use(express.static(__dirname + '/../../public'))

  // Add browserchannel client-side scripts to model bundles created by store,
  // and return middleware for responding to remote client messages
  .use(racerBrowserChannel(store))
  // Add req.getModel() method
  .use(store.modelMiddleware())

  // Parse form data
  // .use(express.bodyParser())
  // .use(express.methodOverride())

  // Session middleware
  .use(express.cookieParser())
  .use(express.session({
    secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
  , store: new MongoStore({url: mongoUrl, safe: true})
  }))
  .use(createUserId)

  // Create an express middleware from the app's routes
  .use($$app$$.router())
  .use(expressApp.router)
  .use(error())


// SERVER-SIDE ROUTES //

expressApp.all('*', function(req, res, next) {
  next('404: ' + req.url);
});
