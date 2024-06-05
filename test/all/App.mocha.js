const expect = require('chai').expect;
const racer = require('racer');
const sinon = require('sinon');
const AppForClient = require('../../src/App').AppForClient;
const { DerbyForClient } = require('../../src/Derby');
const { DerbyForServer } = require('../../src/DerbyForServer');

describe('App', () => {
  afterEach(() => {
    sinon.restore();
  });

  [DerbyForClient, DerbyForServer].forEach((DerbyClass) => {
    describe(`from ${DerbyClass.name}`, () => {
      it('createPage emits \'page\' event with newly created page', () => {
        const derby = new DerbyClass();
        // A properly working _init() requires a more complicated setup,
        // especially for AppForClient, so stub it out since createPage()
        // doesn't depend on anything in _init().
        sinon.stub(derby.App.prototype, '_init');

        const app = derby.createApp();
        app.model = racer.createModel();

        let pageFromEvent = null;
        app.on('page', (page) => {
          pageFromEvent = page;
        });
        const page1 = app.createPage({});
        expect(pageFromEvent).to.equal(page1);
        const page2 = app.createPage({});
        expect(pageFromEvent).to.equal(page2);
      });
    });
  });
});

describe('App._parseInitialData', () => {
  it('parses simple json', () => {
    const actual = AppForClient._parseInitialData('{"foo": "bar"}');
    expect(actual).to.deep.equal({ foo: 'bar' });
  });

  it('parses escaped json', () => {
    const actual = AppForClient._parseInitialData('{"foo": "<\\u0021bar><\\/bar>"}');
    expect(actual).to.deep.equal({ foo: '<!bar></bar>' });
  });

  it('thorws error with context for unexpected tokens', () => {
    expect(() => AppForClient._parseInitialData('{"foo": b}')).to.throw(
      /^Parse failure: Unexpected token/
    );
  });
});
