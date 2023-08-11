import { ContextClosure, type Template } from './templates';

export class DependencyOptions {
  ignoreTemplate: Template;

  constructor(options: { ignoreTemplate: Template }) {
    this.setIgnoreTemplate(options && options.ignoreTemplate);
  }

  static shouldIgnoreTemplate(template, options?: { ignoreTemplate?: Template }) {
    return (options) ? options.ignoreTemplate === template : false;
  }

  setIgnoreTemplate(template) {
    while (template instanceof ContextClosure) {
      template = template.template;
    }
    this.ignoreTemplate = template;
  }
}
