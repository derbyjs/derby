var expect = require('chai').expect;
var App = require('../../dist/App').App;

describe('App._parseInitialData', () => {
  it('parses simple json', () => {
    var actual = App._parseInitialData('{"foo": "bar"}');
    expect(actual).to.deep.equal({ foo: 'bar' });
  });

  it('parses escaped json', () => {
    var actual = App._parseInitialData('{"foo": "<\\u0021bar><\\/bar>"}');
    expect(actual).to.deep.equal({ foo: '<!bar></bar>' });
  });

  it('thorws error with context for unexpected tokens', () => {
    expect(() => App._parseInitialData('{"foo": b}')).to.throw(
      /^Parse failure: Unexpected token/
    );
  });
});
