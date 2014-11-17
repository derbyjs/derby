var expect = require('expect.js');
var EventModel = require('../../lib/eventmodel');

describe('eventmodel', function() {
  beforeEach(function() {
    this.model = {
      data: {
        x: 1,
        list: [1,2,3],
        objList: [
          {url:'/0', listName:'one'},
          {url:'/1', listName:'two'},
          {url:'/2', listName:'three'}
        ]
      }
    };
    this.em = new EventModel();

    var self = this;

    // This is a helper to update the data model and trigger EM bindings in one go.
    this.set = function(segments, value) {
      var d = self.model.data;
      for (var i = 0; i < segments.length - 1; i++) {
        d = d[segments[i]];
      }
      d[segments[segments.length - 1]] = value;

      self.em.set(segments);
    };

    // Lots of these tests need to check that a binding is called. This isn't
    // bound or anything, but its really handy code.
    this.updateCalled = 0;
    this.insertCalled = 0;
    this.insertArgs = null;

    this.binding = {
      update:function() {self.updateCalled++;},
      insert:function(index, howMany) {
        self.insertCalled++;
        this.insertArgs = {index:index, howMany:howMany};
      },
    };
  });

  it('updates any object references under a path when remove/insert/move happens');

  describe('sets', function() {
    it('updates a binding when its value changes', function() {
      this.em.addBinding(['x'], this.binding);
      this.set(['x'], 10);

      expect(this.updateCalled).equal(1);
    });

    it('updates a fixed list element binding', function() {
      this.em.addBinding(['list', 1], this.binding);
      this.set(['list', 1], 10);

      expect(this.updateCalled).equal(1);
    });

    it('updates bound children when the parent is replaced', function() {
      this.em.addBinding(['list', 1], this.binding);
      this.set(['list'], [4,5,6]);

      expect(this.updateCalled).equal(1);
    });

    it('lets you bind to places with currently undefined values', function() {
      this.em.addBinding(['list', 10], this.binding);
      this.set(['list', 10], 'hi');

      expect(this.updateCalled).equal(1);
    });
  });

  describe('lists', function() {
    it('Does not update an item binding inside a list item when something is inserted around it', function() {
      //var ctx = {item:1};
      //this.em.addBinding(['list', ctx], this.binding);

    });
  });

  describe('array lookup', function() {
    it('updates a binding if the index changes value', function() {
      var ref = this.em.arrayLookup(this.model, ['list'], ['x']);
      this.em.addBinding(['list', ref], this.binding);

      this.set(['x'], 0);

      expect(this.updateCalled).equal(1);
    });

    it('updates a binding if the resolved path changes', function() {
      var ref = this.em.arrayLookup(this.model, ['list'], ['x']);
      this.em.addBinding(['list', ref], this.binding);

      this.set(['list', 1], 10);
      expect(this.updateCalled).equal(1);
    });

    it('reuses the array reference if we call arrayLookup again', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);
      expect(ref1).equal(ref2);
    });

    it('reuses the array reference if we call arrayLookup after moving the inner value', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);

      this.set(['x', 0]);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);

      expect(ref1).equal(ref2);
    });

    it('reuses the array reference if we call arrayLookup after moving the outer value', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);

      this.set(['list', 1], 10);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);

      expect(ref1).equal(ref2);
    });

    it('allows chained references', function() {
      // For this test we'll try and access objList[list[x]].listName. x is 1,
      // list[1] is 2 and objList[2].listName is 'three'.

      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);
      var ref2 = this.em.arrayLookup(this.model, ['objList'], ['list', ref1]);

      this.em.addBinding(['objList', ref2, 'listName'], this.binding);

      this.set(['objList', 2, 'listName'], 'internet');
      expect(this.updateCalled).equal(1);

      this.set(['list', 1], 0);
      expect(this.updateCalled).equal(2);

      this.set(['x'], 0);
      expect(this.updateCalled).equal(3);

      // Going back out again to make sure that all the bindings have been updated correctly.
      this.set(['list', 0], 0);
      expect(this.updateCalled).equal(4);

      this.set(['objList', 0, 'listName'], 'superman');
      expect(this.updateCalled).equal(5);

      // Some things that should not update the binding.
      this.set(['objList', 2, 'listName'], 'blah');
      this.set(['objList', 1, 'listName'], 'superduper');
      this.set(['list', 1], 1);
      expect(this.updateCalled).equal(5);
    });

    it('lets you bind to a property in an object', function() {
      this.set(['x'], 'url');
      var ref = this.em.arrayLookup(this.model, ['objList', 1], ['x']);

      this.em.addBinding(['objList', 1, ref], this.binding);

      this.set(['objList', 1, 'url'], 'http://example.com');
      expect(this.updateCalled).equal(1);

      this.set(['x'], 'listName');
      expect(this.updateCalled).equal(2);
    });
  });
});

