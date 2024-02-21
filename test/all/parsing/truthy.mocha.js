var expect = require('chai').expect;
var parsing = require('../../../src/parsing');

describe('template truthy', function() {

  it('gets standard truthy value for if block', function() {
    expect(parsing.createExpression('if false').truthy()).equal(false);
    expect(parsing.createExpression('if undefined').truthy()).equal(false);
    expect(parsing.createExpression('if null').truthy()).equal(false);
    expect(parsing.createExpression('if ""').truthy()).equal(false);
    expect(parsing.createExpression('if []').truthy()).equal(false);

    expect(parsing.createExpression('if true').truthy()).equal(true);
    expect(parsing.createExpression('if 0').truthy()).equal(false);
    expect(parsing.createExpression('if 1').truthy()).equal(true);
    expect(parsing.createExpression('if "Hi"').truthy()).equal(true);
    expect(parsing.createExpression('if [0]').truthy()).equal(true);
    expect(parsing.createExpression('if {}').truthy()).equal(true);
    expect(parsing.createExpression('if {foo: 0}').truthy()).equal(true);
  });

  it('gets inverse truthy value for unless block', function() {
    expect(parsing.createExpression('unless false').truthy()).equal(true);
    expect(parsing.createExpression('unless undefined').truthy()).equal(true);
    expect(parsing.createExpression('unless null').truthy()).equal(true);
    expect(parsing.createExpression('unless ""').truthy()).equal(true);
    expect(parsing.createExpression('unless []').truthy()).equal(true);

    expect(parsing.createExpression('unless true').truthy()).equal(false);
    expect(parsing.createExpression('unless 0').truthy()).equal(true);
    expect(parsing.createExpression('unless 1').truthy()).equal(false);
    expect(parsing.createExpression('unless "Hi"').truthy()).equal(false);
    expect(parsing.createExpression('unless [0]').truthy()).equal(false);
    expect(parsing.createExpression('unless {}').truthy()).equal(false);
    expect(parsing.createExpression('unless {foo: 0}').truthy()).equal(false);
  });

  it('gets always truthy value for else block', function() {
    parsing.createExpression('else');
    expect(parsing.createExpression('else').truthy()).equal(true);
  });

});
