import { type Model } from 'racer';
import util = require('racer/lib/util');

import { type AppBase, type App } from './App';
import components = require('./components');
import { Controller } from './Controller';
import documentListeners = require('./documentListeners');
import EventModel = require('./eventmodel');
import * as derbyTemplates from './templates';
import { Context } from './templates/contexts';
import { Expression } from './templates/expressions';
import textDiff = require('./textDiff');

const {
  contexts,
  DependencyOptions,
  expressions,
  templates,
} = derbyTemplates;

export abstract class PageBase extends Controller {
  params: any;
  context: Context;
  create: (model: Model, dom: any) => void;
  init?: (model: Model) => void;
  _components: Record<string, components.Component>
  _eventModel: any;
  _removeModelListeners: () => void = () => {};
  page: PageBase;

  constructor(app: AppBase, model: Model) {
    super(app, null, model);
    this.params = null;
    this._eventModel = null;
    this._removeModelListeners = () => {};
    this._components = {};
    if (this.init) this.init(model);
    this.context = this._createContext();
    this.page = this;
  }

  $bodyClass(ns: string) {
    if (!ns) return;
    const classNames = [];
    const segments = ns.split(':');
    for (let i = 0, len = segments.length; i < len; i++) {
      const className = segments.slice(0, i + 1).join('-');
      classNames.push(className);
    }
    return classNames.join(' ');
  }

  get(viewName: string, ns: string, unescaped?) {
    this._setRenderPrefix(ns);
    const view = this.getView(viewName, ns);
    return view.get(this.context, unescaped);
  }

  getFragment(viewName: string, ns: string) {
    this._setRenderPrefix(ns);
    const view = this.getView(viewName, ns);
    return view.getFragment(this.context);
  }

  getView(viewName: string, ns: string) {
    return this.app.views.find(viewName, ns);
  }

  destroy() {
    this.emit('destroy');
    if (this._removeModelListeners) {
      this._removeModelListeners();
    }
    for (const id in this._components) {
      const component = this._components[id];
      component.destroy();
    }
    // Remove all data, refs, listeners, and reactive functions
    // for the previous page
    const silentModel = this.model.silent();
    silentModel.destroy('_page');
    silentModel.destroy('$components');
    // Unfetch and unsubscribe from all queries and documents
    if (silentModel.unloadAll) {
      silentModel.unloadAll();
    }
  }

  _createContext() {
    const contextMeta = new contexts.ContextMeta();
    contextMeta.views = this.app && this.app.views;
    const context = new contexts.Context(contextMeta, this);
    context.expression = new expressions.PathExpression([]);
    context.alias = '#root';
    return context;
  }

  _setRenderPrefix(ns: string) {
    const prefix = (ns) ? ns + ':' : '';
    this.model.set('$render.prefix', prefix);
  }

  _setRenderParams(ns) {
    this.model.set('$render.ns', ns);
    this.model.set('$render.params', this.params);
    this.model.set('$render.url', this.params && this.params.url);
    this.model.set('$render.query', this.params && this.params.query);
  }
}

export class Page extends PageBase {
  constructor(app: App, model: Model) {
    super(app, model);
    this._addListeners();
  }

  $preventDefault(e: Event) {
    e.preventDefault();
  }

  $stopPropagation(e: Event) {
    e.stopPropagation();
  }

  attach() {
    this.context.pause();
    const ns = this.model.get('$render.ns');
    const titleView = this.getView('TitleElement', ns);
    const bodyView = this.getView('BodyElement', ns);
    const titleElement = document.getElementsByTagName('title')[0];
    titleView.attachTo(titleElement.parentNode, titleElement, this.context);
    bodyView.attachTo(document.body.parentNode, document.body, this.context);
    this.context.unpause();
    if (this.create) {
      this.create(this.model, this.dom);
    }
  }

  render(ns: string) {
    this.app.emit('render', this);
    this.context.pause();
    this._setRenderParams(ns);
    const titleFragment = this.getFragment('TitleElement', ns);
    const bodyFragment = this.getFragment('BodyElement', ns);
    const titleElement = document.getElementsByTagName('title')[0];
    titleElement.parentNode.replaceChild(titleFragment, titleElement);
    document.body.parentNode.replaceChild(bodyFragment, document.body);
    this.context.unpause();
    if (this.create) {
      this.create(this.model, this.dom);
    }
    this.app.emit('routeDone', this, 'render');
  }

  private _addListeners() {
    const eventModel = this._eventModel = new EventModel();
    this._addModelListeners(eventModel);
    this._addContextListeners(eventModel);
  }

  private _addModelListeners(eventModel) {
    const model = this.model;
    if (!model) return;
    // Registering model listeners with the *Immediate events helps to prevent
    // a bug with binding updates where a model listener causes a change to the
    // path being listened on, directly or indirectly.

    // TODO: Remove this when upgrading Racer to the next major version. Feature
    // detect which type of event listener to register by emitting a test event
    if (useLegacyListeners(model)) {
      return this._addModelListenersLegacy(eventModel);
    }

    // `util.castSegments(segments)` is needed to cast string segments into
    // numbers, since EventModel#child does typeof checks against segments. This
    // could be done once in Racer's Model#emit, instead of in every listener.
    const changeListener = model.on('changeImmediate', function onChange(segments, event) {
      // The pass parameter is passed in for special handling of updates
      // resulting from stringInsert or stringRemove
      segments = util.castSegments(segments.slice());
      eventModel.set(segments, event.previous, event.passed);
    });
    const loadListener = model.on('loadImmediate', function onLoad(segments) {
      segments = util.castSegments(segments.slice());
      eventModel.set(segments);
    });
    const unloadListener = model.on('unloadImmediate', function onUnload(segments, event) {
      segments = util.castSegments(segments.slice());
      eventModel.set(segments, event.previous);
    });
    const insertListener = model.on('insertImmediate', function onInsert(segments, event) {
      segments = util.castSegments(segments.slice());
      eventModel.insert(segments, event.index, event.values.length);
    });
    const removeListener = model.on('removeImmediate', function onRemove(segments, event) {
      segments = util.castSegments(segments.slice());
      eventModel.remove(segments, event.index, event.values.length);
    });
    const moveListener = model.on('moveImmediate', function onMove(segments, event) {
      segments = util.castSegments(segments.slice());
      eventModel.move(segments, event.from, event.to, event.howMany);
    });

    this._removeModelListeners = function() {
      model.removeListener('changeImmediate', changeListener);
      model.removeListener('loadImmediate', loadListener);
      model.removeListener('unloadImmediate', unloadListener);
      model.removeListener('insertImmediate', insertListener);
      model.removeListener('removeImmediate', removeListener);
      model.removeListener('moveImmediate', moveListener);
    };
  }

  private _addModelListenersLegacy(eventModel) {
    const model = this.model;
    if (!model) return;

    // `util.castSegments(segments)` is needed to cast string segments into
    // numbers, since EventModel#child does typeof checks against segments. This
    // could be done once in Racer's Model#emit, instead of in every listener.
    const changeListener = model.on('changeImmediate', function onChange(segments, eventArgs) {
      // eventArgs[0] is the new value, which Derby bindings don't use directly.
      // The pass parameter is passed in for special handling of updates
      // resulting from stringInsert or stringRemove
      const [ previous, pass ] = eventArgs;
      segments = util.castSegments(segments.slice());
      eventModel.set(segments, previous, pass);
    });
    const loadListener = model.on('loadImmediate', function onLoad(segments) {
      segments = util.castSegments(segments.slice());
      eventModel.set(segments);
    });
    const unloadListener = model.on('unloadImmediate', function onUnload(segments) {
      segments = util.castSegments(segments.slice());
      eventModel.set(segments);
    });
    const insertListener = model.on('insertImmediate', function onInsert(segments, eventArgs) {
      const [index, values] = eventArgs;
      segments = util.castSegments(segments.slice());
      eventModel.insert(segments, index, values.length);
    });
    const removeListener = model.on('removeImmediate', function onRemove(segments, eventArgs) {
      const [index, values] = eventArgs;
      segments = util.castSegments(segments.slice());
      eventModel.remove(segments, index, values.length);
    });
    const moveListener = model.on('moveImmediate', function onMove(segments, eventArgs) {
      const [from, to, howMany] = eventArgs;
      segments = util.castSegments(segments.slice());
      eventModel.move(segments, from, to, howMany);
    });

    this._removeModelListeners = function() {
      model.removeListener('changeImmediate', changeListener);
      model.removeListener('loadImmediate', loadListener);
      model.removeListener('unloadImmediate', unloadListener);
      model.removeListener('insertImmediate', insertListener);
      model.removeListener('removeImmediate', removeListener);
      model.removeListener('moveImmediate', moveListener);
    };
  }

  private _addContextListeners(eventModel) {
    this.context.meta.addBinding = addBinding;
    this.context.meta.removeBinding = removeBinding;
    this.context.meta.removeNode = removeNode;
    this.context.meta.addItemContext = addItemContext;
    this.context.meta.removeItemContext = removeItemContext;

    function addItemContext(context) {
      const segments = context.expression.resolve(context);
      eventModel.addItemContext(segments, context);
    }
    function removeItemContext(_context) {
      // TODO
    }
    function addBinding(binding) {
      patchTextBinding(binding);
      const expressions = binding.template.expressions;
      if (expressions) {
        for (let i = 0, len = expressions.length; i < len; i++) {
          addDependencies(eventModel, expressions[i], binding);
        }
      } else {
        const expression = binding.template.expression;
        addDependencies(eventModel, expression, binding);
      }
    }
    function removeBinding(binding) {
      const bindingWrappers = binding.meta;
      if (!bindingWrappers) return;
      for (let i = bindingWrappers.length; i--;) {
        eventModel.removeBinding(bindingWrappers[i]);
      }
    }
    function removeNode(node) {
      const component = node.$component;
      if (component) component.destroy();
      const destroyListeners = node.$destroyListeners;
      if (destroyListeners) {
        for (let i = 0; i < destroyListeners.length; i++) {
          destroyListeners[i]();
        }
      }
    }
  }
}

function useLegacyListeners(model) {
  let useLegacy = true;
  // model.once is broken in older racer, so manually remove event
  const listener = model.on('changeImmediate', function(_segments, event) {
    model.removeListener('changeImmediate', listener);
    // Older Racer emits an array of eventArgs, whereas newer racer emits an event object
    useLegacy = Array.isArray(event);
  });
  model.set('$derby.testEvent', true);
  return useLegacy;
}

function addDependencies(eventModel, expression, binding) {
  const bindingWrapper = new BindingWrapper(eventModel, expression, binding);
  bindingWrapper.updateDependencies();
}

// The code here uses object-based set pattern where objects are keyed using
// sequentially generated IDs.
let nextId = 1;
export class BindingWrapper{
  binding: any;
  dependencies: any;
  eventModel: any;
  eventModels: any;
  expression: Expression;
  id: number;
  ignoreTemplateDependency: boolean;

  constructor(eventModel, expression, binding) {
    this.eventModel = eventModel;
    this.expression = expression;
    this.binding = binding;
    this.id = nextId++;
    this.eventModels = null;
    this.dependencies = null;
    this.ignoreTemplateDependency = (
      binding instanceof components.ComponentAttributeBinding
    ) || (
      (binding.template instanceof templates.DynamicText) &&
      (binding instanceof templates.RangeBinding)
    );
    if (binding.meta) {
      binding.meta.push(this);
    } else {
      binding.meta = [this];
    }
  }
  
  updateDependencies = function() {
    let dependencyOptions;
    if (this.ignoreTemplateDependency && this.binding.condition instanceof templates.Template) {
      dependencyOptions = new DependencyOptions();
      dependencyOptions.setIgnoreTemplate(this.binding.condition);
    }

    const dependencies = this.expression.dependencies(this.binding.context, dependencyOptions);
    if (this.dependencies) {
      // Do nothing if dependencies haven't changed
      if (equalDependencies(this.dependencies, dependencies)) return;
      // Otherwise, remove current dependencies
      this.eventModel.removeBinding(this);
    }
    
    // Add new dependencies
    if (!dependencies) return;
  
    this.dependencies = dependencies;
    for (let i = 0, len = dependencies.length; i < len; i++) {
      const dependency = dependencies[i];
      if (dependency) this.eventModel.addBinding(dependency, this);
    }
  };
  
  update = function(previous, pass) {
    this.binding.update(previous, pass);
    this.updateDependencies();
  };
  
  insert = function(index, howMany) {
    this.binding.insert(index, howMany);
    this.updateDependencies();
  };
  
  remove = function(index, howMany) {
    this.binding.remove(index, howMany);
    this.updateDependencies();
  };
  
  move = function(from, to, howMany) {
    this.binding.move(from, to, howMany);
    this.updateDependencies();
  };
}

function equalDependencies(a, b) {
  const lenA = a ? a.length : -1;
  const lenB = b ? b.length : -1;
  if (lenA !== lenB) return false;
  for (let i = 0; i < lenA; i++) {
    const itemA = a[i];
    const itemB = b[i];
    const lenItemA = itemA ? itemA.length : -1;
    const lenItemB = itemB ? itemB.length : -1;
    if (lenItemA !== lenItemB) return false;
    for (let j = 0; j < lenItemB; j++) {
      if (itemA[j] !== itemB[j]) return false;
    }
  }
  return true;
}

function patchTextBinding(binding) {
  if (
    binding instanceof templates.AttributeBinding &&
    binding.name === 'value' &&
    (binding.element.tagName === 'INPUT' || binding.element.tagName === 'TEXTAREA') &&
    documentListeners.inputSupportsSelection(binding.element) &&
    binding.template.expression.resolve(binding.context)
  ) {
    binding.update = textInputUpdate;
  }
}

function textInputUpdate(previous, pass) {
  textUpdate(this, this.element, previous, pass);
}

function textUpdate(binding, element, previous, pass) {
  if (pass) {
    if (pass.$event && pass.$event.target === element) {
      return;
    } else if (pass.$stringInsert) {
      return textDiff.onStringInsert(
        element,
        previous,
        pass.$stringInsert.index,
        pass.$stringInsert.text
      );
    } else if (pass.$stringRemove) {
      return textDiff.onStringRemove(
        element,
        previous,
        pass.$stringRemove.index,
        pass.$stringRemove.howMany
      );
    }
  }
  binding.template.update(binding.context, binding);
}
