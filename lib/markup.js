var eventBinding = require('./eventBinding')
  , splitEvents = eventBinding.splitEvents
  , containsEvent = eventBinding.containsEvent
  , addDomEvent = eventBinding.addDomEvent
  , TEXT_EVENTS = 'keyup,keydown,paste/0,dragover/0,blur'
  , AUTOCOMPLETE_OFF = {
      checkbox: true
    , radio: true
    }
  , onBindA, onBindForm;

module.exports = {
  bound: {
    'value': {
      'input': function(events, attrs, name) {
        var eventNames, method;
        if (attrs.type === 'radio') return;
        if ('x-blur' in attrs) {
          // Only update after the element loses focus
          delete attrs['x-blur'];
          eventNames = 'change,blur';
        } else {
          // By default, update as the user types
          eventNames = TEXT_EVENTS;
        }
        if ('x-ignore-focus' in attrs) {
          // Update value regardless of focus
          delete attrs['x-ignore-focus'];
          method = 'prop';
        } else {
          // Update value unless window and element are focused
          method = 'propPolite';
        }
        addDomEvent(events, attrs, eventNames, name, {
          method: 'prop'
        , property: 'value'
        });
        return {method: method};
      }
    }

  , 'checked': {
      '*': function(events,  attrs, name) {
        addDomEvent(events, attrs, 'change', name, {
          method: 'prop'
        , property: 'checked'
        });
        return {method: 'prop'};
      }
    }

  , 'selected': {
      '*': function(events, attrs, name) {
        addDomEvent(events, attrs, 'change', name, {
          method: 'prop'
        , property: 'selected'
        });
        return {method: 'prop'};
      }
    }

  , 'disabled': {
      '*': function() {
        return {method: 'prop'};
      }
    }
  }

, boundParent: {
    'contenteditable': {
      '*': function(events, attrs, name) {
        addDomEvent(events, attrs, TEXT_EVENTS, name, {
          method: 'html'
        });
      }
    }

  , '*': {
      'textarea': function(events, attrs, name) {
        addDomEvent(events, attrs, TEXT_EVENTS, name, {
          method: 'prop'
        , property: 'value'
        });
        return {method: 'prop', property: 'value'};
      }
    }
  }

, element: {
    'select': function(events, attrs) {
      // Distribute change event to child nodes of select elements
      addDomEvent(events, attrs, 'change:$forChildren');
      return {addId: true};
    }

  , 'input': function(events, attrs) {
      if (AUTOCOMPLETE_OFF[attrs.type] && !('autocomplete' in attrs)) {
        attrs.autocomplete = 'off';
      }
      if (attrs.type === 'radio') {
        // Distribute change events to other elements with the same name
        addDomEvent(events, attrs, 'change:$forName');
      }
    }
  }

, attr: {
    'x-bind': {
      '*': function(events, attrs, eventNames) {
        addDomEvent(events, attrs, eventNames);
        return {addId: true, del: true};
      }

    , 'a': onBindA = function(events, attrs, eventNames) {
        if (containsEvent(eventNames, 'click') && !('href' in attrs)) {
          attrs.href = '#';
          if (!('onclick' in attrs)) {
            attrs.onclick = 'return false';
          }
        }
      }

    , 'form': onBindForm = function(events, attrs, eventNames) {
        if (containsEvent(eventNames, 'submit')) {
          if (!('onsubmit' in attrs)) {
            attrs.onsubmit = 'return false';
          }
        }
      }
    }

  , 'x-capture': {
      '*': function(events, attrs, eventNames) {
        addDomEvent(events, attrs, eventNames, null, {capture: true});
        return {addId: true, del: true};
      }
    , 'a': onBindA
    , 'form': onBindForm
    }

  , 'x-as': {
      '*': function() {
        // TODO
        return {addId: true, del: true}
      }
  }

  , 'checked': {
      '*': function() {
        return {bool: true};
      }
    }

  , 'selected': {
      '*': function() {
        return {bool: true};
      }
    }

  , 'disabled': {
      '*': function() {
        return {bool: true};
      }
    }
  }

, TEXT_EVENTS: TEXT_EVENTS
, AUTOCOMPLETE_OFF: AUTOCOMPLETE_OFF
};
