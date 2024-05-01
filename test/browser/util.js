var chai = require('chai');
var DerbyStandalone = require('../../src/DerbyStandalone');
require('../../src/parsing');
require('../../test-utils').assertions(window, chai.Assertion);

exports.derby = new DerbyStandalone();
