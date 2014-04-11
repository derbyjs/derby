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
  )
}
function inputIsNumberValue(input) {
  var type = input.type;
  return (type === 'number' || (type === 'range' && !input.multiple))
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
  if (!target) return;
  var bindAttributes = target.$bindAttributes;
  if (!bindAttributes) return;
  var tagName = target.tagName.toLowerCase();

  if (tagName === 'input' && bindAttributes.value) {
    var binding = bindAttributes.value;
    if (binding.isUnbound()) return;
    if (inputSupportsSelection(target)) {
      var pass = {$event: e};
      textDiffBinding(binding, target.value, pass);
    } else {
      var value = inputValue(target);
      binding.template.expression.set(binding.context, value);
    }
  } else if (tagName === 'textarea') {
    // TODO
  } else if (target.isContentEditable) {
    // TODO
  }
}

function documentChange(e) {
  var target = e.target;
  if (!target) return;
  var bindAttributes = target.$bindAttributes;
  var tagName = target.tagName.toLowerCase();

  if (tagName === 'input') {
    if (bindAttributes && bindAttributes.checked) {
      var binding = bindAttributes.checked;
      binding.template.expression.set(binding.context, target.checked);
    }

  } else if (tagName === 'select') {
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
    if (node.tagName && node.tagName.toLowerCase() === 'option') {
      var binding = node.$bindAttributes && node.$bindAttributes.selected;
      if (binding) binding.template.expression.set(binding.context, node.selected);
    } else if (node.hasChildNodes()) {
      setOptionBindings(node);
    }
  }
}
