var templates = require('./templates');

exports.DependencyOptions = DependencyOptions;

function DependencyOptions(options) {
  this.setIgnoreTemplate(options && options.ignoreTemplate);
}
DependencyOptions.shouldIgnoreTemplate = function(template, options) {
  return (options) ? options.ignoreTemplate === template : false;
};
DependencyOptions.prototype.setIgnoreTemplate = function(template) {
  while (template instanceof templates.ContextClosure) {
    template = template.template;
  }
  this.ignoreTemplate = template;
};
