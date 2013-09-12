var EventModel = require('../lib/eventmodel');
var ObjectModel = require('../lib/expressions').ObjectModel;
var assert = require('assert');

describe('eventmodel', function() {
  beforeEach(function() {
    this.data = {
      x: 1,
      list: [1,2,3],
      objList: [
        {url:'/0', listName:'one'},
        {url:'/1', listName:'two'},
        {url:'/2', listName:'three'}
      ]
    };

    this.model = new ObjectModel(this.data);
    this.em = new EventModel();

    var self = this;

    // This is a helper to update the data model and trigger EM bindings in one go.
    this.set = function(segments, value) {
      var d = self.data;
      for (var i = 0; i < segments.length - 1; i++) {
        d = d[segments[i]];
      }
      d[segments[segments.length - 1]] = value;

      self.em.setAt(segments);
    }

    // Lots of these tests need to check that a binding is called. This isn't
    // bound or anything, but its really handy code.
    this.bindingCalled = 0;
    this.binding = {
      update:function() {
        self.bindingCalled++;
      }
    };
  });

  it('updates any object references under a path when remove/insert/move happens');

  describe('array lookup', function() {

    it('updates a binding if the index changes value', function() {
      var ref = this.em.arrayLookup(this.model, ['list'], ['x']);
      this.em.addBinding(['list', ref], this.binding);

      this.set(['x'], 0);

      assert.equal(this.bindingCalled, 1);
    });

    it('updates a binding if the resolved path changes', function() {
      var ref = this.em.arrayLookup(this.model, ['list'], ['x']);
      this.em.addBinding(['list', ref], this.binding);

      this.set(['list', 1], 10);
      assert.equal(this.bindingCalled, 1);
    });

    it('reuses the array reference if we call arrayLookup again', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);
      assert.strictEqual(ref1, ref2);
    });

    it('reuses the array reference if we call arrayLookup after moving the inner value', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);

      this.set(['x', 0]);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);
      
      assert.strictEqual(ref1, ref2);
    });

    it('reuses the array reference if we call arrayLookup after moving the outer value', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);

      this.set(['list', 1], 10);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);
      
      assert.strictEqual(ref1, ref2);
    });

    it('allows chained references', function() {
      // For this test we'll try and access objList[list[x]].listName. x is 1,
      // list[1] is 2 and objList[2].listName is 'three'.

      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);
      var ref2 = this.em.arrayLookup(this.model, ['objList'], ['list', ref1]);

      this.em.addBinding(['objList', ref2, 'listName'], this.binding);

      this.set(['objList', 2, 'listName'], 'internet');
      assert.strictEqual(this.bindingCalled, 1);

      this.set(['list', 1], 0);
      assert.strictEqual(this.bindingCalled, 2);

      this.set(['x'], 0);
      assert.strictEqual(this.bindingCalled, 3);
    });
  });


  describe('expandSegments', function() {
    it('passes through primitive values', function() {
      assert.deepEqual(EventModel.expandSegments([1, 2, 3, 'a', 'b', 'c']), [1, 2, 3, 'a', 'b', 'c']);
    });
    
    it('expands item contexts', function() {
      // I'm not making a real context object because I shouldn't need to - ...
      var context = {item:5}
      assert.deepEqual(EventModel.expandSegments(['a', context, 'b']), ['a', 5, 'b']);
    });
    
    it('expands array references', function() {
      var ref = this.em.arrayLookup(this.model, ['objList'], ['x']);
      assert.deepEqual(EventModel.expandSegments(['objList', ref, 'url']), ['objList', 1, 'url']);

      this.set(['x'], 2);

      assert.deepEqual(EventModel.expandSegments(['objList', ref, 'url']), ['objList', 2, 'url']);
    });
 
  });
});

