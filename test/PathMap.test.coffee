{wrapTest} = require './util'
should = require 'should'
PathMap = require '../src/PathMap'

module.exports =

  'should create ids and double index them': ->
    pathMap = new PathMap
    pathMap.count.should.eql 0
    pathMap.ids.should.eql {}
    pathMap.paths.should.eql {}

    pathMap.id('colors.green').should.eql 1
    pathMap.count.should.eql 1
    pathMap.ids.should.eql {'colors.green': 1}
    pathMap.paths.should.eql {1: 'colors.green'}
  
  'should return same id for same path': ->
    pathMap = new PathMap
    pathMap.id('colors.green').should.eql pathMap.id('colors.green')

  'should return different id for different path': ->
    pathMap = new PathMap
    pathMap.id('colors.green').should.not.eql pathMap.id('colors.red')
  
  'should index array paths': ->
    pathMap = new PathMap
    pathMap.arrays.should.eql {}

    # A path is assumed to be an array path if it contains a segment
    # of only decimal digits
    pathMap.id('colors.0').should.eql 1
    pathMap.id('colors.0.hex').should.eql 2
    pathMap.id('colors.0.rgb').should.eql 3
    pathMap.id('colors.1.hex').should.eql 4
    pathMap.ids.should.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.0.rgb': 3
      'colors.1.hex': 4
    }
    pathMap.paths.should.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.0.rgb'
      4: 'colors.1.hex'
    }
    # Array index has keys of the array path. The value is an array
    # that mirrors the structure of the indexed array. Each item in
    # the array is a map from path ids to the remainder of the path
    pathMap.arrays.should.eql {
      colors: [
        {1: '', 2: '.hex', 3: '.rgb'}
        {4: '.hex'}
      ]
    }
  
  'onRemove should update path indicies': ->
    pathMap = new PathMap
    pathMap.id('colors.0').should.eql 1
    pathMap.id('colors.0.hex').should.eql 2
    pathMap.id('colors.1').should.eql 3
    pathMap.id('colors.1.hex').should.eql 4
    pathMap.id('colors.2').should.eql 5
    pathMap.id('colors.2.hex').should.eql 6
    pathMap.id('colors.3').should.eql 7
    pathMap.id('colors.3.hex').should.eql 8

    pathMap.onRemove 'colors', 3, 1
    pathMap.ids.should.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.1': 3
      'colors.1.hex': 4
      'colors.2': 5
      'colors.2.hex': 6
    }
    pathMap.paths.should.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.1'
      4: 'colors.1.hex'
      5: 'colors.2'
      6: 'colors.2.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {1: '', 2: '.hex'}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onRemove 'colors', 0, 2
    pathMap.ids.should.eql {
      'colors.0': 5
      'colors.0.hex': 6
    }
    pathMap.paths.should.eql {
      5: 'colors.0'
      6: 'colors.0.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {5: '', 6: '.hex'}
      ]
    }
  
    pathMap.onRemove 'colors', 0, 1
    pathMap.ids.should.eql {}
    pathMap.paths.should.eql {}
    pathMap.arrays.should.eql {
      colors: []
    }
  
  'onInsert should update path indicies': ->
    pathMap = new PathMap
    pathMap.id('colors.0').should.eql 1
    pathMap.id('colors.0.hex').should.eql 2
    pathMap.id('colors.1').should.eql 3
    pathMap.id('colors.1.hex').should.eql 4
    pathMap.id('colors.2').should.eql 5
    pathMap.id('colors.2.hex').should.eql 6

    pathMap.onInsert 'colors', 1, 2
    pathMap.ids.should.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.3': 3
      'colors.3.hex': 4
      'colors.4': 5
      'colors.4.hex': 6
    }
    pathMap.paths.should.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.3'
      4: 'colors.3.hex'
      5: 'colors.4'
      6: 'colors.4.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {1: '', 2: '.hex'}
        {}
        {}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onInsert 'colors', 0, 1
    pathMap.ids.should.eql {
      'colors.1': 1
      'colors.1.hex': 2
      'colors.4': 3
      'colors.4.hex': 4
      'colors.5': 5
      'colors.5.hex': 6
    }
    pathMap.paths.should.eql {
      1: 'colors.1'
      2: 'colors.1.hex'
      3: 'colors.4'
      4: 'colors.4.hex'
      5: 'colors.5'
      6: 'colors.5.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {}
        {1: '', 2: '.hex'}
        {}
        {}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onInsert 'colors', 6, 1
    pathMap.ids.should.eql {
      'colors.1': 1
      'colors.1.hex': 2
      'colors.4': 3
      'colors.4.hex': 4
      'colors.5': 5
      'colors.5.hex': 6
    }
    pathMap.paths.should.eql {
      1: 'colors.1'
      2: 'colors.1.hex'
      3: 'colors.4'
      4: 'colors.4.hex'
      5: 'colors.5'
      6: 'colors.5.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {}
        {1: '', 2: '.hex'}
        {}
        {}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
        {}
      ]
    }

  'onMove should update path indicies': ->
    pathMap = new PathMap
    pathMap.id('colors.0').should.eql 1
    pathMap.id('colors.0.hex').should.eql 2
    pathMap.id('colors.1').should.eql 3
    pathMap.id('colors.1.hex').should.eql 4
    pathMap.id('colors.2').should.eql 5
    pathMap.id('colors.2.hex').should.eql 6

    pathMap.onMove 'colors', 0, 1
    pathMap.ids.should.eql {
      'colors.0': 3
      'colors.0.hex': 4
      'colors.1': 1
      'colors.1.hex': 2
      'colors.2': 5
      'colors.2.hex': 6
    }
    pathMap.paths.should.eql {
      3: 'colors.0'
      4: 'colors.0.hex'
      1: 'colors.1'
      2: 'colors.1.hex'
      5: 'colors.2'
      6: 'colors.2.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {3: '', 4: '.hex'}
        {1: '', 2: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onMove 'colors', 1, 0
    pathMap.ids.should.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.1': 3
      'colors.1.hex': 4
      'colors.2': 5
      'colors.2.hex': 6
    }
    pathMap.paths.should.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.1'
      4: 'colors.1.hex'
      5: 'colors.2'
      6: 'colors.2.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {1: '', 2: '.hex'}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onMove 'colors', 2, 0
    pathMap.ids.should.eql {
      'colors.0': 5
      'colors.0.hex': 6
      'colors.1': 1
      'colors.1.hex': 2
      'colors.2': 3
      'colors.2.hex': 4
    }
    pathMap.paths.should.eql {
      5: 'colors.0'
      6: 'colors.0.hex'
      1: 'colors.1'
      2: 'colors.1.hex'
      3: 'colors.2'
      4: 'colors.2.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {5: '', 6: '.hex'}
        {1: '', 2: '.hex'}
        {3: '', 4: '.hex'}
      ]
    }

    pathMap.onMove 'colors', 0, 2
    pathMap.ids.should.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.1': 3
      'colors.1.hex': 4
      'colors.2': 5
      'colors.2.hex': 6
    }
    pathMap.paths.should.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.1'
      4: 'colors.1.hex'
      5: 'colors.2'
      6: 'colors.2.hex'
    }
    pathMap.arrays.should.eql {
      colors: [
        {1: '', 2: '.hex'}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }
