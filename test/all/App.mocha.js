const expect = require('chai').expect;
const App = require('../../lib/App');

describe('App._parseInitialData', () => {
  it('parses simple json', () => {
    const actual = App._parseInitialData('{"foo": "bar"}');
    expect(actual).to.deep.equal({ foo: 'bar' });
  });

  it('parses escaped json', () => {
    const actual = App._parseInitialData('{"foo": "<\\u0021bar><\\/bar>"}');
    expect(actual).to.deep.equal({ foo: '<!bar></bar>' });
  });

  it('thorws error with context for unexpected tokens', () => {
    try {
      const actual = App._parseInitialData('{"foo": b}');
    } catch (error) {
      expect(error.message).to.equal(
        'Parse failure: Unexpected token b in JSON at position 8 context: \'{"foo": b}\'',
      );
    }
  });
});
