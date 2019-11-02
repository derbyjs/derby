var chai = require('chai');
var DerbyStandalone = require('../../lib/DerbyStandalone');
require('derby-parsing');
require('../../test-utils').assertions(window, chai.Assertion);

exports.derby = new DerbyStandalone();
