var DerbyStandalone = require('./DerbyStandalone');
global.derby = new DerbyStandalone();

// Include template and expression parsing
require('derby-templates');
