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
  var pass = {$event: e};

  if ((tagName === 'input' || tagName === 'textarea') && bindAttributes.value) {
    textDiffBinding(bindAttributes.value, target.value, pass);

  } else if (target.isContentEditable) {

  }
}

function documentChange(e) {
  var target = e.target;
  if (!target) return;
  var tagName = target.tagName.toLowerCase();
  var bindAttributes = target.$bindAttributes;

  if (tagName === 'input') {
    if (bindAttributes.checked) {
      var binding = bindAttributes.checked;
      binding.template.expression.set(binding.context, target.checked);
    }

  } else if (tagName === 'select') {

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
