import { Converter, ReflectionFlag, ReflectionKind } from "typedoc";
import camelCase from "camelcase";

/**
 * @param {Readonly<import('typedoc').Application>} app
 */
export function load(app) {
  /**
   * Create declaration event handler that sets symbols with underscore-prefixed names
   * to private to exclude from generated documentation.
   *
   * Due to "partial class" style of code in use, otherwise private properties and methods -
   * prefixed with underscore - are effectively declared public so they can be accessed in other
   * files used to build class - e.g. Model. This marks anything prefixed with an underscore and
   * no doc comment as private.
   *
   * @param {import('typedoc').Context} context
   * @param {import('typedoc').DeclarationReflection} reflection
   */
  function handleCreateDeclaration(context, reflection) {
    if (!reflection.name.startsWith('_')) {
      return;
    }
    if (!reflection.comment) {
      reflection.setFlag(ReflectionFlag.Private);
    }
  }

  app.converter.on(Converter.EVENT_CREATE_DECLARATION, handleCreateDeclaration);
}