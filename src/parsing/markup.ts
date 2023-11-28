import { EventEmitter } from 'events';

import { createPathExpression } from './createPathExpression';
import { templates } from '../templates';

class MarkupParser extends EventEmitter { }

// TODO: Should be its own module
export const markup = new MarkupParser();

markup.on('element:a', function(template) {
  if (hasListenerFor(template, 'click')) {
    const attributes = template.attributes || (template.attributes = {});
    if (!attributes.href) {
      attributes.href = new templates.Attribute('#');
      addListener(template, 'click', '$preventDefault($event)');
    }
  }
});

markup.on('element:form', function(template) {
  if (hasListenerFor(template, 'submit')) {
    addListener(template, 'submit', '$preventDefault($event)');
  }
});

function hasListenerFor(template, eventName) {
  const hooks = template.hooks;
  if (!hooks) return false;
  for (let i = 0, len = hooks.length; i < len; i++) {
    const hook = hooks[i];
    if (hook instanceof templates.ElementOn && hook.name === eventName) {
      return true;
    }
  }
  return false;
}

function addListener(template, eventName, source) {
  const hooks = template.hooks || (template.hooks = []);
  const expression = createPathExpression(source);
  hooks.push(new templates.ElementOn(eventName, expression));
}
