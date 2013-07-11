var eventBinding = require('./eventBinding')
  , splitEvents = eventBinding.splitEvents
  , containsEvent = eventBinding.containsEvent
  , addDomEvent = eventBinding.addDomEvent
  , TEXT_EVENTS = 'keyup,keydown/0,cut/0,paste/0,dragover/0,blur'
  , AUTOCOMPLETE_OFF = {
      checkbox: true
    , radio: true
    }
  , onBindA, onBindForm;

module.exports = {
  bound: {
    'value': {
      'input': function(events, attrs, match) {
        var type = attrs.type
          , eventNames, method;
        if (type === 'radio' || type === 'checkbox') return;
        if (type === 'range' || 'x-blur' in attrs) {
          // Only update after the element loses focus
          delete attrs['x-blur'];
          eventNames = 'change,blur';
        } else {
          // By default, update as the user types
          eventNames = TEXT_EVENTS;
        }
        if ('x-atomic' in attrs) {
          delete attrs['x-atomic'];
          method = 'prop';
        } else if (type === 'text' || !type) {
          method = 'propOt';
        } else {
          method = 'prop';
        }
        addDomEvent(events, attrs, eventNames, match, {
          method: method
        , property: 'value'
        });
        return {method: method};
      }
    }

  , 'checked': {
      '*': function(events,  attrs, match) {
        addDomEvent(events, attrs, 'change', match, {
          method: 'prop'
        , property: 'checked'
        });
        return {method: 'prop'};
      }
    }

  , 'selected': {
      '*': function(events, attrs, match) {
        addDomEvent(events, attrs, 'change', match, {
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
      '*': function(events, attrs, match) {
        addDomEvent(events, attrs, TEXT_EVENTS, match, {
          method: 'html'
        });
      }
    }

  , '*': {
      'textarea': function(events, attrs, match) {
        if ('x-atomic' in attrs) {
          delete attrs['x-atomic'];
          var method = 'prop';
        } else {
          var method = 'propOt';
        }
        addDomEvent(events, attrs, TEXT_EVENTS, match, {
          method: method
        , property: 'value'
        });
        return {method: method, property: 'value'};
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
        if (containsEvent(eventNames, ['click', 'focus']) && !('href' in attrs)) {
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
      '*': function(events, attrs, name) {
        events.push(function(ctx) {
          ctx.$elements[name] = attrs._id || attrs.id;
        });
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

  , 'autofocus': {
      '*': function() {
        return {bool: true};
      }
    }
  }

, TEXT_EVENTS: TEXT_EVENTS
, AUTOCOMPLETE_OFF: AUTOCOMPLETE_OFF
};
