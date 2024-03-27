var expect = require('chai').expect;
var derbyTemplates = require('../../../src/templates');
var contexts = derbyTemplates.contexts;
var templates = derbyTemplates.templates;
var parsing = require('../../../src/parsing');
var createExpression = parsing.createExpression;
var createTemplate = parsing.createTemplate;

var controller = {
  plus: function(a, b) {
    return a + b;
  },
  minus: function(a, b) {
    return a - b;
  },
  greeting: function() {
    return 'Hi.';
  },
  keys: function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    return keys;
  },
  passThrough: function(value) {
    return value;
  },
  informal: {
    greeting: function() {
      return 'Yo!';
    }
  },
  Date: Date,
  global: global
};
controller.model = {
  data: {
    key: 'green',
    lightTemplate: createTemplate('light {{_page.colors[key].name}}'),
    _page: {
      colors: {
        green: {
          name: 'Green',
          hex: '#0f0',
          rgb: [0, 255, 0],
          light: {
            hex: '#90ee90'
          },
          dark: {
            hex: '#006400'
          }
        }
      },
      key: 'green',
      channel: 0,
      variation: 'light',
      variationHex: 'light.hex',
      keys: ['red', 'green'],
      index: 1,
      tagName: 'div',
      html: '<div>Hi</div>',
      nums: [2, 11, 3, 7],
      first: 2,
      second: 3,
      year: 2018,
      date: new Date(1000)
    }
  }
};
controller.model.scope = function(path) {
  return {
    _at: path,
    path: function() {
      return this._at;
    }
  };
};
var views = new templates.Views();
var contextMeta = new contexts.ContextMeta({views: views});
var context = new contexts.Context(contextMeta, controller);
var view = new templates.View();

function stripContexts(dependencies) {
  if (!dependencies) return dependencies;
  for (var i = 0; i < dependencies.length; i++) {
    var dependency = dependencies[i];
    for (var j = 0; j < dependency.length; j++) {
      var segment = dependency[j];
      if (segment instanceof contexts.Context) {
        dependency[j] = {item: segment.item};
      }
    }
  }
  return dependencies;
}

describe('template dependencies', function() {
  describe('text', function() {
    it('gets dependencies', function() {
      var template = createTemplate('Hi');
      expect(template.dependencies(context)).to.equal(undefined);
      expect(template.get(context)).to.equal('Hi');
    });
  });

  describe('dynamic text', function() {
    it('gets dependencies', function() {
      var template = createTemplate('{{_page.key}}');
      expect(template.dependencies(context)).to.eql([['_page', 'key']]);
      expect(template.get(context)).to.equal('green');
    });
  });

  describe('with block', function() {
    it('gets dependencies', function() {
      var template = createTemplate(
        '{{with _page.key as #key}}' +
          '{{_page.colors[#key].name}}' +
        '{{/with}}');
      expect(template.dependencies(context)).to.eql([
        ['_page', 'key'],
        ['_page', 'colors', 'green', 'name']
      ]);
      expect(template.get(context)).to.equal('Green');
    });
  });

  describe('on block', function() {
    it('gets dependencies', function() {
      var template = createTemplate(
        '{{on _page.key}}' +
          '{{_page.variation}}' +
        '{{/on}}');
      expect(template.dependencies(context)).to.eql([
        ['_page', 'key'],
        ['_page', 'variation']
      ]);
      expect(template.get(context)).to.equal('light');
    });
  });

  describe('each block', function() {
    it('gets item alias dependencies', function() {
      var template = createTemplate(
        '{{each _page.keys as #key}}' +
          '{{#key}}' +
        '{{/each}}');
      expect(stripContexts(template.dependencies(context))).to.eql([
        ['_page', 'keys'],
        ['_page', 'keys', {item: 0}],
        ['_page', 'keys', {item: 1}]
      ]);
      expect(template.get(context)).to.equal('redgreen');
    });

    it('gets index alias dependencies', function() {
      var template = createTemplate(
        '{{each _page.keys as #key, #i}}' +
          '{{#i}}.' +
        '{{/each}}');
      expect(stripContexts(template.dependencies(context))).to.eql([
        ['_page', 'keys'],
        ['_page', 'keys'],
        ['_page', 'keys'],
      ]);
      expect(template.get(context)).to.equal('0.1.');
    });

    it('gets alias dependencies from a literal', function() {
      var template = createTemplate(
        '{{each [33, 77] as #key, #i}}' +
          '{{#i}},{{#key}};' +
        '{{/each}}');
      expect(stripContexts(template.dependencies(context))).to.equal(undefined);
      expect(template.get(context)).to.equal('0,33;1,77;');
    });
  });

  describe('HTML', function() {
    it('gets empty Template dependencies', function() {
      var template = createTemplate('');
      expect(template.dependencies(context)).to.equal(null);
      expect(template.get(context)).to.equal('');
    });

    it('gets Doctype dependencies', function() {
      var template = createTemplate('<!DOCTYPE html>');
      expect(template.dependencies(context)).to.equal(undefined);
      expect(template.get(context)).to.equal('<!DOCTYPE html>');
    });

    it('gets Text dependencies', function() {
      var template = createTemplate('Hi!');
      expect(template.dependencies(context)).to.equal(undefined);
      expect(template.get(context)).to.equal('Hi!');
    });

    it('gets DynamicText dependencies', function() {
      var template = createTemplate('Choose {{_page.key}}');
      expect(template.dependencies(context)).to.eql([
        ['_page', 'key']
      ]);
      expect(template.get(context)).to.equal('Choose green');
    });

    it('gets Comment dependencies', function() {
      var template = createTemplate('<!--[Copyright 1999]-->');
      expect(template.dependencies(context)).to.equal(undefined);
      expect(template.get(context)).to.equal('<!--[Copyright 1999]-->');
    });

    it.skip('gets DynamicComment dependencies from parsed template', function() {
      // Template tag within comment is not parsed. It probably should be,
      // since we do parse the content of other special regions, such as the
      // text inside of scripts and styles
      var template = createTemplate('<!--[Copyright {{_page.year}}]-->');
      expect(template.dependencies(context)).to.eql([
        ['_page', 'year']
      ]);
      expect(template.get(context)).to.equal('<!--[Copyright 2018]-->');
    });

    it('gets DynamicComment dependencies', function() {
      var expression = createExpression('_page.year');
      var template = new templates.DynamicComment(expression);
      expect(template.dependencies(context)).to.eql([
        ['_page', 'year']
      ]);
      expect(template.get(context)).to.equal('<!--2018-->');
    });

    it('gets Html dependencies', function() {
      // It is not currently possible to create a template of type Html via
      // derby-parsing, as there is no syntax that would require it
      var template = new templates.Html('<div>Hi</div>');
      expect(template.dependencies(context)).to.equal(undefined);
      expect(template.get(context)).to.equal('<div>Hi</div>');
    });

    it('gets DynamicHtml dependencies', function() {
      var template = createTemplate('{{unescaped _page.html}}');
      expect(template.dependencies(context)).to.eql([
        ['_page', 'html']
      ]);
      expect(template.get(context)).to.equal('<div>Hi</div>');
    });

    it('gets Element dependencies', function() {
      var template = createTemplate('<div>Hi<br>there</div>');
      expect(template.dependencies(context)).to.equal(undefined);
      expect(template.get(context)).to.equal('<div>Hi<br>there</div>');
    });

    it('gets DynamicElement dependencies', function() {
      var template = createTemplate('<tag is="{{_page.tagName}}">Hello</tag>');
      expect(template.dependencies(context)).to.eql([
        ['_page', 'tagName']
      ]);
      expect(template.get(context)).to.equal('<div>Hello</div>');
    });

    it('gets Attribute dependencies', function() {
      var template = createTemplate('<img src="foo">');
      expect(template.dependencies(context)).to.equal(undefined);
      expect(template.get(context)).to.equal('<img src="foo">');
    });

    it('gets DynamicAttribute dependencies', function() {
      var template = createTemplate('<img src="{{_page.key}}">');
      expect(template.dependencies(context)).to.eql([
        ['_page', 'key']
      ]);
      expect(template.get(context)).to.equal('<img src="green">');
    });
  });
});

describe('expression dependencies', function() {

  describe('literal', function() {
    it('gets literal dependencies', function() {
      var expression = createExpression('34');
      expect(expression.dependencies(context)).to.equal(undefined);
    });
  });

  describe('path', function() {
    it('gets path dependencies', function() {
      var expression = createExpression('_page.colors.green.name');
      expect(expression.dependencies(context)).to.eql([['_page', 'colors', 'green', 'name']]);
    });
  });

  describe('brackets', function() {
    it('gets bracket + path dependencies', function() {
      var expression = createExpression('_page.colors[_page.key].name');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'key'],
        ['_page', 'colors', 'green', 'name']
      ]);
    });

    it('gets bracket + path + bracket + path dependencies', function() {
      var expression = createExpression('_page.colors[_page.key].rgb[_page.channel]');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'key'],
        ['_page', 'channel'],
        ['_page', 'colors', 'green', 'rgb', 0]
      ]);
    });

    it('gets bracket + bracket + path dependencies', function() {
      var expression = createExpression('_page.colors[_page.key][_page.variation].hex');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'key'],
        ['_page', 'variation'],
        ['_page', 'colors', 'green', 'light', 'hex']
      ]);
    });

    it('gets nested bracket + path dependencies', function() {
      var expression = createExpression('_page.colors[_page.keys[_page.index]].name');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'index'],
        ['_page', 'keys', 1],
        ['_page', 'colors', 'green', 'name']
      ]);
    });
  });

  describe('fn', function() {
    it('gets path + path dependencies', function() {
      var expression = createExpression('plus(_page.nums[0], _page.nums[1])');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 0, '*'],
        ['_page', 'nums', 1, '*']
      ]);
    });

    it('gets path + fn dependencies', function() {
      var expression = createExpression('plus(_page.nums[0], minus(_page.nums[3], _page.nums[2]))');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 0, '*'],
        ['_page', 'nums', 3, '*'],
        ['_page', 'nums', 2, '*']
      ]);
    });

    it('gets bracket + bracket dependencies', function() {
      var expression = createExpression('plus(_page.nums[_page.first], _page.nums[_page.second])');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'first'],
        ['_page', 'nums', 2, '*'],
        ['_page', 'second'],
        ['_page', 'nums', 3, '*']
      ]);
    });

    it('gets fn inside bracket dependencies', function() {
      var expression = createExpression('_page.keys[minus(_page.nums[2], _page.nums[0])]');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 2, '*'],
        ['_page', 'nums', 0, '*'],
        ['_page', 'keys', 1]
      ]);
    });
  });

  describe('operators', function() {
    it('gets path + path dependencies', function() {
      var expression = createExpression('_page.nums[0] + _page.nums[1]');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 0, '*'],
        ['_page', 'nums', 1, '*']
      ]);
    });

    it('gets chained operator dependencies', function() {
      var expression = createExpression('_page.nums[0] + (_page.nums[3] - _page.nums[2])');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 0, '*'],
        ['_page', 'nums', 3, '*'],
        ['_page', 'nums', 2, '*']
      ]);
    });

    it('gets bracket + bracket dependencies', function() {
      var expression = createExpression('_page.nums[_page.first] + _page.nums[_page.second]');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'first'],
        ['_page', 'nums', 2, '*'],
        ['_page', 'second'],
        ['_page', 'nums', 3, '*']
      ]);
    });

    it('gets operator inside bracket dependencies', function() {
      var expression = createExpression('_page.keys[_page.nums[2] - _page.nums[0]]');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 2, '*'],
        ['_page', 'nums', 0, '*'],
        ['_page', 'keys', 1],
      ]);
    });

    it('gets path + literal dependencies', function() {
      var expression = createExpression('_page.nums[0] + 3');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 0, '*']
      ]);
    });

    it('gets path + literal + path dependencies', function() {
      var expression = createExpression('_page.nums[0] + (100 - _page.nums[2])');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 0, '*'],
        ['_page', 'nums', 2, '*']
      ]);
    });

    it('gets path + bracket dependencies', function() {
      var expression = createExpression('_page.nums[2] + _page.nums[_page.second]');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 2, '*'],
        ['_page', 'second'],
        ['_page', 'nums', 3, '*']
      ]);
    });

    it('gets path + literal inside bracket dependencies', function() {
      var expression = createExpression('_page.keys[_page.nums[2] - 2]');
      expect(expression.dependencies(context)).to.eql([
        ['_page', 'nums', 2, '*'],
        ['_page', 'keys', 1]
      ]);
    });
  });

  describe('relative paths', function() {
    describe('with block', function() {
      it('gets dependencies', function() {
        var aliasExpression = createExpression('with _page.colors.green');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('this');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green']
        ]);
        expect(expression.get(blockContext).name).to.eql('Green');
      });

      it('gets subpath dependencies', function() {
        var aliasExpression = createExpression('with _page.colors.green');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('this.name');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green', 'name']
        ]);
        expect(expression.get(blockContext)).to.eql('Green');
      });

      it('gets function dependencies', function() {
        var aliasExpression = createExpression('with passThrough(_page.colors.green)');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('this');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green', '*']
        ]);
        expect(expression.get(blockContext).name).to.eql('Green');
      });

      it('gets subpath from function dependencies', function() {
        var aliasExpression = createExpression('with passThrough(_page.colors.green)');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('this.name');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green', '*']
        ]);
        expect(expression.get(blockContext)).to.eql('Green');
      });

      it('gets template in model dependencies', function() {
        var aliasExpression = createExpression('with lightTemplate');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('this');
        expect(expression.dependencies(blockContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green', 'name'],
          ['lightTemplate']
        ]);
        expect(expression.get(blockContext)).an.instanceOf(templates.Template);
      });

      it('gets subpath from template in model dependencies', function() {
        // Getting a template returns a string, so this combination is not
        // likely to be of much use. However, this test is included to clarify
        // what is expected behavior
        var aliasExpression = createExpression('with lightTemplate');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('this.length');
        expect(expression.dependencies(blockContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green', 'name'],
          ['lightTemplate', 'length']
        ]);
        expect(expression.get(blockContext)).to.eql(11);
      });
    });
  });

  describe('aliases', function() {
    describe('with block', function() {
      it('gets dependencies', function() {
        var aliasExpression = createExpression('with _page.colors.green as #color');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('#color');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green']
        ]);
        expect(expression.get(blockContext).name).to.eql('Green');
      });

      it('gets subpath dependencies', function() {
        var aliasExpression = createExpression('with _page.colors.green as #color');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('#color.name');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green', 'name']
        ]);
        expect(expression.get(blockContext)).to.eql('Green');
      });

      it('gets function dependencies', function() {
        var aliasExpression = createExpression('with passThrough(_page.colors.green) as #color');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('#color');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green', '*']
        ]);
        expect(expression.get(blockContext).name).to.eql('Green');
      });

      it('gets subpath from function dependencies', function() {
        var aliasExpression = createExpression('with passThrough(_page.colors.green) as #color');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('#color.name');
        expect(expression.dependencies(blockContext)).to.eql([
          ['_page', 'colors', 'green', '*']
        ]);
        expect(expression.get(blockContext)).to.eql('Green');
      });

      it('gets template in model dependencies', function() {
        var aliasExpression = createExpression('with lightTemplate as #color');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('#color');
        expect(expression.dependencies(blockContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green', 'name'],
          ['lightTemplate']
        ]);
        expect(expression.get(blockContext)).an.instanceOf(templates.Template);
      });

      it('gets subpath from template in model dependencies', function() {
        // Getting a template returns a string, so this combination is not
        // likely to be of much use. However, this test is included to clarify
        // what is expected behavior
        var aliasExpression = createExpression('with lightTemplate as #color');
        var blockContext = context.child(aliasExpression);
        var expression = createExpression('#color.length');
        expect(expression.dependencies(blockContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green', 'name'],
          ['lightTemplate', 'length']
        ]);
        expect(expression.get(blockContext)).to.eql(11);
      });
    });

    describe('each block', function() {
      it('gets item alias dependencies', function() {
        var aliasExpression = createExpression('each _page.keys as #key, #index');
        var eachContext = context.eachChild(aliasExpression, 0);
        var expression = createExpression('#key');
        expect(expression.dependencies(eachContext)).to.eql([
          ['_page', 'keys', eachContext]
        ]);
        expect(expression.get(eachContext)).to.eql('red');
      });

      it('gets subpath from item alias dependencies', function() {
        var aliasExpression = createExpression('each _page.keys as #key, #index');
        var eachContext = context.eachChild(aliasExpression, 0);
        var expression = createExpression('#key.length');
        expect(expression.dependencies(eachContext)).to.eql([
          ['_page', 'keys', eachContext, 'length']
        ]);
        expect(expression.get(eachContext)).to.eql(3);
      });

      it('gets key alias dependencies', function() {
        var aliasExpression = createExpression('each _page.keys as #key, #index');
        var eachContext = context.eachChild(aliasExpression, 0);
        var expression = createExpression('#index');
        expect(expression.dependencies(eachContext)).to.eql([
          ['_page', 'keys']
        ]);
        expect(expression.get(eachContext)).to.eql(0);
      });
    });
  });

  describe('view attributes', function() {
    describe('expression values', function() {
      it('gets path dependencies', function() {
        var attributes = {
          color: createExpression('_page.colors.green')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color');
        expect(expression.dependencies(viewContext)).to.eql([
          ['_page', 'colors', 'green']
        ]);
        expect(expression.get(viewContext).name).to.eql('Green');
      });

      it('gets subpath from path dependencies', function() {
        var attributes = {
          color: createExpression('_page.colors.green')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color.name');
        expect(expression.dependencies(viewContext)).to.eql([
          ['_page', 'colors', 'green', 'name']
        ]);
        expect(expression.get(viewContext)).to.eql('Green');
      });

      it('gets function dependencies', function() {
        var attributes = {
          color: createExpression('passThrough(_page.colors.green)')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color');
        expect(expression.dependencies(viewContext)).to.eql([
          ['_page', 'colors', 'green', '*']
        ]);
        expect(expression.get(viewContext).name).to.eql('Green');
      });

      it('gets subpath from function dependencies', function() {
        var attributes = {
          color: createExpression('passThrough(_page.colors.green)')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color.name');
        expect(expression.dependencies(viewContext)).to.eql([
          ['_page', 'colors', 'green', '*']
        ]);
        expect(expression.get(viewContext)).to.eql('Green');
      });

      it('gets bracket dependencies', function() {
        var attributes = {
          color: createExpression('_page.colors[key]')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color');
        expect(expression.dependencies(viewContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green']
        ]);
        expect(expression.get(viewContext).name).to.eql('Green');
      });

      it('gets subpath from bracket dependencies', function() {
        var attributes = {
          color: createExpression('_page.colors[key]')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color.name');
        expect(expression.dependencies(viewContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green', 'name']
        ]);
        expect(expression.get(viewContext)).to.eql('Green');
      });
    });

    describe('template values', function() {
      it('gets function template attribute dependencies', function() {
        var attributes = {
          color: createTemplate('light{{_page.colors.green.name}}')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color');
        expect(expression.dependencies(viewContext)).to.eql([
          ['_page', 'colors', 'green', 'name']
        ]);
        expect(expression.get(viewContext)).an.instanceOf(templates.Template);
      });

      it('gets subpath from function template attribute dependencies', function() {
        var attributes = {
          color: createTemplate('light{{_page.colors.green.name}}')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color.length');
        expect(expression.dependencies(viewContext)).to.eql([
          ['_page', 'colors', 'green', 'name']
        ]);
        expect(expression.get(viewContext)).equal(10);
      });

      it('gets template in model attribute dependencies', function() {
        var attributes = {
          color: createExpression('lightTemplate')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color');
        expect(expression.dependencies(viewContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green', 'name'],
          ['lightTemplate']
        ]);
        expect(expression.get(viewContext)).an.instanceOf(templates.Template);
      });

      it('gets subpath from template in model attribute dependencies', function() {
        var attributes = {
          color: createExpression('lightTemplate')
        };
        var viewContext = context.viewChild(view, attributes);
        var expression = createExpression('@color.length');
        expect(expression.dependencies(viewContext)).to.eql([
          ['key'],
          ['_page', 'colors', 'green', 'name'],
          ['lightTemplate', 'length']
        ]);
        expect(expression.get(viewContext)).equal(11);
      });
    });
  });
});
