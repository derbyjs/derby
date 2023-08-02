const templates = require('./templates');

export class DependencyOptions{
  ignoreTemplate: boolean;

  constructor(options: { ignoreTemplate: boolean }) {
    this.setIgnoreTemplate(options && options.ignoreTemplate);
  }

  static shouldIgnoreTemplate(template, options) {
    return (options) ? options.ignoreTemplate === template : false;
  }

  setIgnoreTemplate(template) {
    while (template instanceof templates.ContextClosure) {
      template = template.template;
    }
    this.ignoreTemplate = template;
  }
}
