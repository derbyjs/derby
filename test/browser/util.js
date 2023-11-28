var chai = require('chai');
var DerbyStandalone = require('../../dist/DerbyStandalone');
require('../../dist/parsing');
require('../../test-utils').assertions(window, chai.Assertion);

exports.derby = new DerbyStandalone();
