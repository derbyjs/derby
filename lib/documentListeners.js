var textDiff = require('./textDiff');

exports.add = addDocumentListeners;

function addDocumentListeners(doc) {
  doc || (doc = window.document);
  doc.addEventListener('input', documentInput, true);
  doc.addEventListener('change', documentChange, true);
}

function documentInput(e) {
  var target = e.target;
  if (!target) return;
  var tagName = target.tagName.toLowerCase();
  var bindAttributes = target.$bindAttributes;

  if (tagName === 'input' && bindAttributes.value) {
    textDiffBinding(bindAttributes.value, target.value);
  } else if (tagName === 'textarea') {

  } else if (target.isContentEditable) {

  }
}

function documentChange(e) {
  var target = e.target;
  if (!target) return;
  var tagName = target.tagName.toLowerCase();
  var bindAttributes = target.$bindAttributes;

  if (tagName === 'input') {

  } else if (tagName === 'select') {

  }
}

function textDiffBinding(binding, value) {
  var expression = binding.template.template;
  if (!expression || !expression.resolve) return;

  var segments = expression.resolve(binding.context);
  if (segments) {
    var model = binding.context.controller.model;
    var path = segments.join('.');
    textDiff.onTextInput(model, path, value);
  } else if (expression.set) {
    expression.set(binding.context, value);
  }
}
