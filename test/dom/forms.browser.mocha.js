import { expect } from 'chai';
import * as domTestRunner from '../../src/test-utils/domTestRunner';

describe('forms', function() {
  const runner = domTestRunner.install();

  function createEvent(type) {
    return new runner.window.Event(type, {bubbles: true});
  }

  describe('textarea', function() {

    beforeEach(function() {
      this.fixture = document.createElement('ins');
      document.body.appendChild(this.fixture);
    });
    afterEach(function() {
      document.body.removeChild(this.fixture);
    });

    it('renders text content in textarea', function() {
      const { app } = runner.createHarness();
      app.views.register('Body', '<textarea>{{_page.text}}</textarea>');
      var page = app.createPage();
      var text = page.model.at('_page.text');
      text.set('Hi');
      var fragment = page.getFragment('Body');
      expect(fragment).html('<textarea>Hi</textarea>');
      var textarea = fragment.firstChild;
      expect(textarea.value).equal('Hi');
      var textNode = textarea.firstChild;
      expect(textNode.data).equal('Hi');
    });

    it('updates textarea value on model set', function() {
      const { app } = runner.createHarness();
      app.views.register('Body', '<textarea>{{_page.text}}</textarea>');
      var page = app.createPage();
      var text = page.model.at('_page.text');
      text.set('Hi');
      var fragment = page.getFragment('Body');
      text.set('Yo');
      var textarea = fragment.firstChild;
      expect(textarea.value).equal('Yo');
      // Note that the contained textNode.data need not be updated. Browsers
      // other than IE do not update textarea child nodes when their value is
      // set by JavaScript or user input. Since browsers are inconsistent, the
      // data may or may not be updated
    });

    it('updates model after changing text and emitting change', function() {
      const { app } = runner.createHarness();
      app.views.register('Body', '<textarea>{{_page.text}}</textarea>');
      var page = app.createPage();
      var text = page.model.at('_page.text');
      text.set('Hi');
      var fragment = page.getFragment('Body');
      var textarea = fragment.firstChild;
      var textNode = textarea.firstChild;
      // Insert the fragment in the document so that Derby captures events
      this.fixture.appendChild(fragment);
      textNode.data = 'Yo';
      textarea.dispatchEvent(createEvent('change'));
      expect(textarea.value).equal('Yo');
      expect(text.get()).equal('Yo');
    });

    it('updates model after changing value and emitting change', function() {
      const { app } = runner.createHarness();
      app.views.register('Body', '<textarea>{{_page.text}}</textarea>');
      var page = app.createPage();
      var text = page.model.at('_page.text');
      text.set('Hi');
      var fragment = page.getFragment('Body');
      var textarea = fragment.firstChild;
      // Insert the fragment in the document so that Derby captures events
      this.fixture.appendChild(fragment);
      textarea.value = 'Yo';
      textarea.dispatchEvent(createEvent('change'));
      expect(text.get()).equal('Yo');
    });

    it('updates model after changing value and emitting input', function() {
      const { app } = runner.createHarness();
      app.views.register('Body', '<textarea>{{_page.text}}</textarea>');
      var page = app.createPage();
      var text = page.model.at('_page.text');
      text.set('Hi');
      var fragment = page.getFragment('Body');
      var textarea = fragment.firstChild;
      // Insert the fragment in the document so that Derby captures events
      this.fixture.appendChild(fragment);
      textarea.value = 'Yo';
      textarea.dispatchEvent(createEvent('input'));
      expect(text.get()).equal('Yo');
    });

  });
});
