var textDiff = require('./textDiff');

exports.add = addDocumentListeners;

function addDocumentListeners(doc) {
  doc || (doc = window.document);
  doc.addEventListener('input', changeText, true);
}

function changeText(e) {
  var target = e.target;
  if (!target) return;
  var tagName = target.tagName.toLowerCase();
  if (tagName !== 'input') return;
  var binding = target.$bindAttributes.value;
  if (!binding) return;
  var expression = binding.template.template;
  if (!expression || !expression.resolve) return;

  var segments = expression.resolve(binding.context);
  if (segments) {
    var model = binding.context.controller.model;
    var path = segments.join('.');
    textDiff.onTextInput(model, path, target.value);
  } else if (expression.set) {
    expression.set(binding.context, target.value);
  }
}
