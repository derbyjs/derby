var EventModel = require('../lib/eventmodel');
var ObjectModel = require('../lib/expressions').ObjectModel;
var assert = require('assert');

describe('eventmodel', function() {
  beforeEach(function() {
    this.data = {
      x: 1,
      list: [1,2,3],
      objList: [
        {url:'1', listName:'one'},
        {url:'2', listName:'two'}
      ]
    };

    this.model = new ObjectModel(this.data);
    this.em = new EventModel();

    // Lots of these tests need to check that a binding is called. This isn't
    // bound or anything, but its really handy code.
    var self = this;
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

      this.data.x = 0;
      this.em.setAt(['x']);

      assert.equal(this.bindingCalled, 1);
    });

    it('updates a binding if the resolved path changes', function() {
      var ref = this.em.arrayLookup(this.model, ['list'], ['x']);
      this.em.addBinding(['list', ref], this.binding);

      this.data.list[1] = 10;
      this.em.setAt(['list', 1]);
      assert.equal(this.bindingCalled, 1);
      //console.log(JSON.stringify(this.em, null, 2));
    });

    it('reuses the array reference if we call arrayLookup again', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);
      assert.strictEqual(ref1, ref2);
    });

    it('reuses the array reference if we call arrayLookup after moving the inner value', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);

      this.data.x = 0;
      this.em.setAt(['x']);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);
      
      assert.strictEqual(ref1, ref2);
    });

    it('reuses the array reference if we call arrayLookup after moving the outer value', function() {
      var ref1 = this.em.arrayLookup(this.model, ['list'], ['x']);

      this.data.list[1] = 10;
      this.em.setAt(['list', 1]);
      var ref2 = this.em.arrayLookup(this.model, ['list'], ['x']);
      
      assert.strictEqual(ref1, ref2);
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

      this.data.x = 2;
      this.em.setAt(['x']);

      assert.deepEqual(EventModel.expandSegments(['objList', ref, 'url']), ['objList', 2, 'url']);
    });
 
  });
});

