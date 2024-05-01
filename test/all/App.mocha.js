var expect = require('chai').expect;
var AppForClient = require('../../src/App').AppForClient;

describe('App._parseInitialData', () => {
  it('parses simple json', () => {
    var actual = AppForClient._parseInitialData('{"foo": "bar"}');
    expect(actual).to.deep.equal({ foo: 'bar' });
  });

  it('parses escaped json', () => {
    var actual = AppForClient._parseInitialData('{"foo": "<\\u0021bar><\\/bar>"}');
    expect(actual).to.deep.equal({ foo: '<!bar></bar>' });
  });

  it('thorws error with context for unexpected tokens', () => {
    expect(() => AppForClient._parseInitialData('{"foo": b}')).to.throw(
      /^Parse failure: Unexpected token/
    );
  });
});
