var textDiff = require('./textDiff');

exports.add = addDocumentListeners;

// http://www.whatwg.org/specs/web-apps/current-work/multipage/the-input-element.html#do-not-apply
// TODO: Date types support
function inputSupportsSelection(input) {
  var type = input.type;
  return (
    type === 'text' ||
    type === 'search' ||
    type === 'url' ||
    type === 'tel' ||
    type === 'password'
  );
}
function inputIsNumberValue(input) {
  var type = input.type;
  return (type === 'number' || (type === 'range' && !input.multiple));
}
function inputValue(input) {
  return inputIsNumberValue(input) ? input.valueAsNumber : input.value;
}

function addDocumentListeners(doc) {
  doc.addEventListener('input', documentInput, true);
  doc.addEventListener('change', documentChange, true);
}

function documentInput(e) {
  var target = e.target;

  if (target.tagName === 'INPUT') {
    var binding = target.$bindAttributes && target.$bindAttributes.value;
    if (!binding || binding.isUnbound()) return;

    if (inputSupportsSelection(target)) {
      var pass = {$event: e};
      textDiffBinding(binding, target.value, pass);
    } else {
      var value = inputValue(target);
      binding.template.expression.set(binding.context, value);
    }

  } else if (target.tagName === 'TEXTAREA' && target.childNodes.length === 1) {
    var binding = target.firstChild && target.firstChild.$bindNode;
    if (!binding || binding.isUnbound()) return;

    var pass = {$event: e};
    textDiffBinding(binding, target.value, pass);
  }
}

function documentChange(e) {
  var target = e.target;
  var bindAttributes = target.$bindAttributes;

  if (target.tagName === 'INPUT') {
    var binding = target.$bindAttributes && target.$bindAttributes.checked;
    if (!binding || binding.isUnbound()) return;
    binding.template.expression.set(binding.context, target.checked);

  } else if (target.tagName === 'SELECT') {
    setOptionBindings(target);
  }
}

function textDiffBinding(binding, value, pass) {
  var expression = binding.template.expression;
  var segments = expression.pathSegments(binding.context);
  if (segments) {
    var model = binding.context.controller.model.pass(pass);
    textDiff.onTextInput(model, segments, value);
  } else if (expression.set) {
    expression.set(binding.context, value);
  }
}

function setOptionBindings(parent) {
  for (var node = parent.firstChild; node; node = node.nextSibling) {
    if (node.tagName === 'OPTION') {
      var binding = node.$bindAttributes && node.$bindAttributes.selected;
      if (!binding || binding.isUnbound()) continue;
      binding.template.expression.set(binding.context, node.selected);
    } else if (node.hasChildNodes()) {
      setOptionBindings(node);
    }
  }
}
