{expect, calls} = require 'racer/test/util'
PathMap = require '../lib/PathMap'

describe 'PathMap', ->

  it 'should create ids and double index them', ->
    pathMap = new PathMap
    expect(pathMap.count).to.eql 0
    expect(pathMap.ids).to.eql {}
    expect(pathMap.paths).to.eql {}

    expect(pathMap.id 'colors.green').to.eql 1
    expect(pathMap.count).to.eql 1
    expect(pathMap.ids).to.eql {'colors.green': 1}
    expect(pathMap.paths).to.eql {1: 'colors.green'}

  it 'should return same id for same path', ->
    pathMap = new PathMap
    expect(pathMap.id 'colors.green').to.eql pathMap.id('colors.green')

  it 'should return different id for different path', ->
    pathMap = new PathMap
    expect(pathMap.id 'colors.green').to.not.eql pathMap.id('colors.red')

  it 'should index array paths', ->
    pathMap = new PathMap
    expect(pathMap.arrays).to.eql {}

    # A path is assumed to be an array path if it contains a segment
    # of only decimal digits
    expect(pathMap.id 'colors.0').to.eql 1
    expect(pathMap.id 'colors.0.hex').to.eql 2
    expect(pathMap.id 'colors.0.rgb').to.eql 3
    expect(pathMap.id 'colors.1.hex').to.eql 4
    expect(pathMap.ids).to.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.0.rgb': 3
      'colors.1.hex': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.0.rgb'
      4: 'colors.1.hex'
    }
    # Array index has keys of the array path. The value is an array
    # that mirrors the structure of the indexed array. Each item in
    # the array is a map from path ids to the remainder of the path
    expect(pathMap.arrays).to.eql {
      colors: [
        {1: '', 2: '.hex', 3: '.rgb'}
        {4: '.hex'}
      ]
    }

  it 'should index nested arrays', ->
    pathMap = new PathMap
    expect(pathMap.arrays).to.eql {}

    expect(pathMap.id 'tables.0.rows.0').to.eql 1
    expect(pathMap.id 'tables.0.rows.1.name').to.eql 2
    expect(pathMap.id 'tables.1.rows.0').to.eql 3
    expect(pathMap.id 'tables.1.rows.1.name').to.eql 4
    # Nested arrays are tracked under an arrays property
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {1: ''}
        {2: '.name'}
      ]
      'tables.1.rows': [
        {3: ''}
        {4: '.name'}
      ]
    }

    expect(pathMap.id 'tables.0.rows.0.cols.0').to.eql 5
    expect(pathMap.id 'tables.0.rows.0.cols.1.text').to.eql 6
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {1: '', arrays: {'.cols': true}}
        {2: '.name'}
      ]
      'tables.1.rows': [
        {3: ''}
        {4: '.name'}
      ]
      'tables.0.rows.0.cols': [
        {5: ''}
        {6: '.text'}
      ]
    }

  it 'onRemove should update array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'colors.0').to.eql 1
    expect(pathMap.id 'colors.0.hex').to.eql 2
    expect(pathMap.id 'colors.1').to.eql 3
    expect(pathMap.id 'colors.1.hex').to.eql 4
    expect(pathMap.id 'colors.2').to.eql 5
    expect(pathMap.id 'colors.2.hex').to.eql 6
    expect(pathMap.id 'colors.3').to.eql 7
    expect(pathMap.id 'colors.3.hex').to.eql 8

    pathMap.onRemove 'colors', 3, 1
    expect(pathMap.ids).to.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.1': 3
      'colors.1.hex': 4
      'colors.2': 5
      'colors.2.hex': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.1'
      4: 'colors.1.hex'
      5: 'colors.2'
      6: 'colors.2.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {1: '', 2: '.hex'}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onRemove 'colors', 0, 2
    expect(pathMap.ids).to.eql {
      'colors.0': 5
      'colors.0.hex': 6
    }
    expect(pathMap.paths).to.eql {
      5: 'colors.0'
      6: 'colors.0.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onRemove 'colors', 0, 1
    expect(pathMap.ids).to.eql {}
    expect(pathMap.paths).to.eql {}
    expect(pathMap.arrays).to.eql {
      colors: []
    }

  it 'onRemove should update single nested array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'tables.0.rows.0').to.eql 1
    expect(pathMap.id 'tables.0.rows.1.name').to.eql 2
    expect(pathMap.id 'tables.1.rows.0').to.eql 3
    expect(pathMap.id 'tables.1.rows.1.name').to.eql 4
    expect(pathMap.id 'tables.2.rows.0').to.eql 5
    expect(pathMap.id 'tables.2.rows.1.name').to.eql 6
    expect(pathMap.id 'tables.3.rows.0').to.eql 7
    expect(pathMap.id 'tables.3.rows.1.name').to.eql 8

    pathMap.onRemove 'tables.0.rows', 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.name': 2
      'tables.1.rows.0': 3
      'tables.1.rows.1.name': 4
      'tables.2.rows.0': 5
      'tables.2.rows.1.name': 6
      'tables.3.rows.0': 7
      'tables.3.rows.1.name': 8
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.name'
      3: 'tables.1.rows.0'
      4: 'tables.1.rows.1.name'
      5: 'tables.2.rows.0'
      6: 'tables.2.rows.1.name'
      7: 'tables.3.rows.0'
      8: 'tables.3.rows.1.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {2: '.name'}
      ]
      'tables.1.rows': [
        {3: ''}
        {4: '.name'}
      ]
      'tables.2.rows': [
        {5: ''}
        {6: '.name'}
      ]
      'tables.3.rows': [
        {7: ''}
        {8: '.name'}
      ]
    }

    pathMap.onRemove 'tables', 1, 2
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.name': 2
      'tables.1.rows.0': 7
      'tables.1.rows.1.name': 8
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.name'
      7: 'tables.1.rows.0'
      8: 'tables.1.rows.1.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {2: '.name'}
      ]
      'tables.1.rows': [
        {7: ''}
        {8: '.name'}
      ]
    }

    pathMap.onRemove 'tables', 1, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.name': 2
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {2: '.name'}
      ]
    }

    pathMap.onRemove 'tables', 0, 1
    expect(pathMap.ids).to.eql {}
    expect(pathMap.paths).to.eql {}
    expect(pathMap.arrays).to.eql {
      'tables': []
    }

  it 'onRemove should update double nested array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'tables.0.rows.0.cols.0').to.eql 1
    expect(pathMap.id 'tables.0.rows.1.cols.0.text').to.eql 2
    expect(pathMap.id 'tables.1.rows.0.cols.0').to.eql 3
    expect(pathMap.id 'tables.1.rows.1.cols.0.text').to.eql 4
    expect(pathMap.id 'tables.2.rows.0.cols.0').to.eql 5
    expect(pathMap.id 'tables.2.rows.1.cols.0.text').to.eql 6
    expect(pathMap.id 'tables.3.rows.0.cols.0').to.eql 7
    expect(pathMap.id 'tables.3.rows.1.cols.0.text').to.eql 8

    pathMap.onRemove 'tables.0.rows', 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0.text': 2
      'tables.1.rows.0.cols.0': 3
      'tables.1.rows.1.cols.0.text': 4
      'tables.2.rows.0.cols.0': 5
      'tables.2.rows.1.cols.0.text': 6
      'tables.3.rows.0.cols.0': 7
      'tables.3.rows.1.cols.0.text': 8
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.cols.0.text'
      3: 'tables.1.rows.0.cols.0'
      4: 'tables.1.rows.1.cols.0.text'
      5: 'tables.2.rows.0.cols.0'
      6: 'tables.2.rows.1.cols.0.text'
      7: 'tables.3.rows.0.cols.0'
      8: 'tables.3.rows.1.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{2: '.text'}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{3: ''}]
      'tables.1.rows.1.cols': [{4: '.text'}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{5: ''}]
      'tables.2.rows.1.cols': [{6: '.text'}]
      'tables.3.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.3.rows.0.cols': [{7: ''}]
      'tables.3.rows.1.cols': [{8: '.text'}]
    }

    pathMap.onRemove 'tables', 1, 2
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0.text': 2
      'tables.1.rows.0.cols.0': 7
      'tables.1.rows.1.cols.0.text': 8
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.cols.0.text'
      7: 'tables.1.rows.0.cols.0'
      8: 'tables.1.rows.1.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{2: '.text'}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{7: ''}]
      'tables.1.rows.1.cols': [{8: '.text'}]
    }

    pathMap.onRemove 'tables', 1, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0.text': 2
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{2: '.text'}]
    }

    pathMap.onRemove 'tables', 0, 1
    expect(pathMap.ids).to.eql {}
    expect(pathMap.paths).to.eql {}
    expect(pathMap.arrays).to.eql {
      'tables': []
    }

  it 'onInsert should update array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'colors.0').to.eql 1
    expect(pathMap.id 'colors.0.hex').to.eql 2
    expect(pathMap.id 'colors.1').to.eql 3
    expect(pathMap.id 'colors.1.hex').to.eql 4
    expect(pathMap.id 'colors.2').to.eql 5
    expect(pathMap.id 'colors.2.hex').to.eql 6

    pathMap.onInsert 'colors', 1, 2
    expect(pathMap.ids).to.eql {
      'colors.0': 1
      'colors.0.hex': 2
      'colors.3': 3
      'colors.3.hex': 4
      'colors.4': 5
      'colors.4.hex': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.0'
      2: 'colors.0.hex'
      3: 'colors.3'
      4: 'colors.3.hex'
      5: 'colors.4'
      6: 'colors.4.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {1: '', 2: '.hex'}
        {}
        {}
        {3: '', 4: '.hex'}
        {5: '', 6: '.hex'}
      ]
    }

    pathMap.onInsert 'colors', 0, 1
    expect(pathMap.ids).to.eql {
      'colors.1': 1
      'colors.1.hex': 2
      'colors.4': 3
      'colors.4.hex': 4
      'colors.5': 5
      'colors.5.hex': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.1'
      2: 'colors.1.hex'
      3: 'colors.4'
      4: 'colors.4.hex'
      5: 'colors.5'
      6: 'colors.5.hex'
    }
    expect(pathMap.arrays).to.eql {
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
    expect(pathMap.ids).to.eql {
      'colors.1': 1
      'colors.1.hex': 2
      'colors.4': 3
      'colors.4.hex': 4
      'colors.5': 5
      'colors.5.hex': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.1'
      2: 'colors.1.hex'
      3: 'colors.4'
      4: 'colors.4.hex'
      5: 'colors.5'
      6: 'colors.5.hex'
    }
    expect(pathMap.arrays).to.eql {
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

  it 'onInsert should update single nested array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'tables.0.rows.0').to.eql 1
    expect(pathMap.id 'tables.0.rows.1.name').to.eql 2
    expect(pathMap.id 'tables.1.rows.0').to.eql 3
    expect(pathMap.id 'tables.1.rows.1.name').to.eql 4
    expect(pathMap.id 'tables.2.rows.0').to.eql 5
    expect(pathMap.id 'tables.2.rows.1.name').to.eql 6

    pathMap.onInsert 'tables.0.rows', 1, 2
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0': 1
      'tables.0.rows.3.name': 2
      'tables.1.rows.0': 3
      'tables.1.rows.1.name': 4
      'tables.2.rows.0': 5
      'tables.2.rows.1.name': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0'
      2: 'tables.0.rows.3.name'
      3: 'tables.1.rows.0'
      4: 'tables.1.rows.1.name'
      5: 'tables.2.rows.0'
      6: 'tables.2.rows.1.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {1: ''}
        {}
        {}
        {2: '.name'}
      ]
      'tables.1.rows': [
        {3: ''}
        {4: '.name'}
      ]
      'tables.2.rows': [
        {5: ''}
        {6: '.name'}
      ]
    }

    pathMap.onInsert 'tables', 1, 2
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0': 1
      'tables.0.rows.3.name': 2
      'tables.3.rows.0': 3
      'tables.3.rows.1.name': 4
      'tables.4.rows.0': 5
      'tables.4.rows.1.name': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0'
      2: 'tables.0.rows.3.name'
      3: 'tables.3.rows.0'
      4: 'tables.3.rows.1.name'
      5: 'tables.4.rows.0'
      6: 'tables.4.rows.1.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {}
        {}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {1: ''}
        {}
        {}
        {2: '.name'}
      ]
      'tables.3.rows': [
        {3: ''}
        {4: '.name'}
      ]
      'tables.4.rows': [
        {5: ''}
        {6: '.name'}
      ]
    }

    pathMap.onInsert 'tables', 0, 1
    expect(pathMap.ids).to.eql {
      'tables.1.rows.0': 1
      'tables.1.rows.3.name': 2
      'tables.4.rows.0': 3
      'tables.4.rows.1.name': 4
      'tables.5.rows.0': 5
      'tables.5.rows.1.name': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.1.rows.0'
      2: 'tables.1.rows.3.name'
      3: 'tables.4.rows.0'
      4: 'tables.4.rows.1.name'
      5: 'tables.5.rows.0'
      6: 'tables.5.rows.1.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {}
        {arrays: {'.rows': true}}
        {}
        {}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.1.rows': [
        {1: ''}
        {}
        {}
        {2: '.name'}
      ]
      'tables.4.rows': [
        {3: ''}
        {4: '.name'}
      ]
      'tables.5.rows': [
        {5: ''}
        {6: '.name'}
      ]
    }

    pathMap.onInsert 'tables', 6, 1
    expect(pathMap.ids).to.eql {
      'tables.1.rows.0': 1
      'tables.1.rows.3.name': 2
      'tables.4.rows.0': 3
      'tables.4.rows.1.name': 4
      'tables.5.rows.0': 5
      'tables.5.rows.1.name': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.1.rows.0'
      2: 'tables.1.rows.3.name'
      3: 'tables.4.rows.0'
      4: 'tables.4.rows.1.name'
      5: 'tables.5.rows.0'
      6: 'tables.5.rows.1.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {}
        {arrays: {'.rows': true}}
        {}
        {}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {}
      ]
      'tables.1.rows': [
        {1: ''}
        {}
        {}
        {2: '.name'}
      ]
      'tables.4.rows': [
        {3: ''}
        {4: '.name'}
      ]
      'tables.5.rows': [
        {5: ''}
        {6: '.name'}
      ]
    }

  it 'onInsert should update double nested array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'tables.0.rows.0.cols.0').to.eql 1
    expect(pathMap.id 'tables.0.rows.1.cols.0.text').to.eql 2
    expect(pathMap.id 'tables.1.rows.0.cols.0').to.eql 3
    expect(pathMap.id 'tables.1.rows.1.cols.0.text').to.eql 4
    expect(pathMap.id 'tables.2.rows.0.cols.0').to.eql 5
    expect(pathMap.id 'tables.2.rows.1.cols.0.text').to.eql 6

    pathMap.onInsert 'tables.0.rows', 1, 2
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0': 1
      'tables.0.rows.3.cols.0.text': 2
      'tables.1.rows.0.cols.0': 3
      'tables.1.rows.1.cols.0.text': 4
      'tables.2.rows.0.cols.0': 5
      'tables.2.rows.1.cols.0.text': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0.cols.0'
      2: 'tables.0.rows.3.cols.0.text'
      3: 'tables.1.rows.0.cols.0'
      4: 'tables.1.rows.1.cols.0.text'
      5: 'tables.2.rows.0.cols.0'
      6: 'tables.2.rows.1.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
        {}
        {}
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{1: ''}]
      'tables.0.rows.3.cols': [{2: '.text'}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{3: ''}]
      'tables.1.rows.1.cols': [{4: '.text'}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{5: ''}]
      'tables.2.rows.1.cols': [{6: '.text'}]
    }

    pathMap.onInsert 'tables', 1, 2
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0': 1
      'tables.0.rows.3.cols.0.text': 2
      'tables.3.rows.0.cols.0': 3
      'tables.3.rows.1.cols.0.text': 4
      'tables.4.rows.0.cols.0': 5
      'tables.4.rows.1.cols.0.text': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0.cols.0'
      2: 'tables.0.rows.3.cols.0.text'
      3: 'tables.3.rows.0.cols.0'
      4: 'tables.3.rows.1.cols.0.text'
      5: 'tables.4.rows.0.cols.0'
      6: 'tables.4.rows.1.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {}
        {}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
        {}
        {}
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{1: ''}]
      'tables.0.rows.3.cols': [{2: '.text'}]
      'tables.3.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.3.rows.0.cols': [{3: ''}]
      'tables.3.rows.1.cols': [{4: '.text'}]
      'tables.4.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.4.rows.0.cols': [{5: ''}]
      'tables.4.rows.1.cols': [{6: '.text'}]
    }

    pathMap.onInsert 'tables', 0, 1
    expect(pathMap.ids).to.eql {
      'tables.1.rows.0.cols.0': 1
      'tables.1.rows.3.cols.0.text': 2
      'tables.4.rows.0.cols.0': 3
      'tables.4.rows.1.cols.0.text': 4
      'tables.5.rows.0.cols.0': 5
      'tables.5.rows.1.cols.0.text': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.1.rows.0.cols.0'
      2: 'tables.1.rows.3.cols.0.text'
      3: 'tables.4.rows.0.cols.0'
      4: 'tables.4.rows.1.cols.0.text'
      5: 'tables.5.rows.0.cols.0'
      6: 'tables.5.rows.1.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {}
        {arrays: {'.rows': true}}
        {}
        {}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
        {}
        {}
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{1: ''}]
      'tables.1.rows.3.cols': [{2: '.text'}]
      'tables.4.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.4.rows.0.cols': [{3: ''}]
      'tables.4.rows.1.cols': [{4: '.text'}]
      'tables.5.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.5.rows.0.cols': [{5: ''}]
      'tables.5.rows.1.cols': [{6: '.text'}]
    }

    pathMap.onInsert 'tables', 6, 1
    expect(pathMap.ids).to.eql {
      'tables.1.rows.0.cols.0': 1
      'tables.1.rows.3.cols.0.text': 2
      'tables.4.rows.0.cols.0': 3
      'tables.4.rows.1.cols.0.text': 4
      'tables.5.rows.0.cols.0': 5
      'tables.5.rows.1.cols.0.text': 6
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.1.rows.0.cols.0'
      2: 'tables.1.rows.3.cols.0.text'
      3: 'tables.4.rows.0.cols.0'
      4: 'tables.4.rows.1.cols.0.text'
      5: 'tables.5.rows.0.cols.0'
      6: 'tables.5.rows.1.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {}
        {arrays: {'.rows': true}}
        {}
        {}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {}
      ]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
        {}
        {}
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{1: ''}]
      'tables.1.rows.3.cols': [{2: '.text'}]
      'tables.4.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.4.rows.0.cols': [{3: ''}]
      'tables.4.rows.1.cols': [{4: '.text'}]
      'tables.5.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.5.rows.0.cols': [{5: ''}]
      'tables.5.rows.1.cols': [{6: '.text'}]
    }

  it 'onMove should update array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'colors.0').to.eql 1
    expect(pathMap.id 'colors.1.hex').to.eql 2
    expect(pathMap.id 'colors.2').to.eql 3
    expect(pathMap.id 'colors.2.hex').to.eql 4

    pathMap.onMove 'colors', 0, 1, 1
    expect(pathMap.ids).to.eql {
      'colors.0.hex': 2
      'colors.1': 1
      'colors.2': 3
      'colors.2.hex': 4
    }
    expect(pathMap.paths).to.eql {
      2: 'colors.0.hex'
      1: 'colors.1'
      3: 'colors.2'
      4: 'colors.2.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {2: '.hex'}
        {1: ''}
        {3: '', 4: '.hex'}
      ]
    }

    pathMap.onMove 'colors', 1, 0, 1
    expect(pathMap.ids).to.eql {
      'colors.0': 1
      'colors.1.hex': 2
      'colors.2': 3
      'colors.2.hex': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.0'
      2: 'colors.1.hex'
      3: 'colors.2'
      4: 'colors.2.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {1: ''}
        {2: '.hex'}
        {3: '', 4: '.hex'}
      ]
    }

    pathMap.onMove 'colors', 2, 0, 1
    expect(pathMap.ids).to.eql {
      'colors.0': 3
      'colors.0.hex': 4
      'colors.1': 1
      'colors.2.hex': 2
    }
    expect(pathMap.paths).to.eql {
      3: 'colors.0'
      4: 'colors.0.hex'
      1: 'colors.1'
      2: 'colors.2.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {3: '', 4: '.hex'}
        {1: ''}
        {2: '.hex'}
      ]
    }

    pathMap.onMove 'colors', 0, 2, 1
    expect(pathMap.ids).to.eql {
      'colors.0': 1
      'colors.1.hex': 2
      'colors.2': 3
      'colors.2.hex': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.0'
      2: 'colors.1.hex'
      3: 'colors.2'
      4: 'colors.2.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {1: ''}
        {2: '.hex'}
        {3: '', 4: '.hex'}
      ]
    }

  it 'onMove of multiple items should update array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'colors.0').to.eql 1
    expect(pathMap.id 'colors.1.hex').to.eql 2
    expect(pathMap.id 'colors.2').to.eql 3
    expect(pathMap.id 'colors.2.hex').to.eql 4

    pathMap.onMove 'colors', 0, 1, 2
    expect(pathMap.ids).to.eql {
      'colors.0': 3
      'colors.0.hex': 4
      'colors.1': 1
      'colors.2.hex': 2
    }
    expect(pathMap.paths).to.eql {
      3: 'colors.0'
      4: 'colors.0.hex'
      1: 'colors.1'
      2: 'colors.2.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {3: '', 4: '.hex'}
        {1: ''}
        {2: '.hex'}
      ]
    }

    pathMap.onMove 'colors', 1, 0, 2
    expect(pathMap.ids).to.eql {
      'colors.0': 1
      'colors.1.hex': 2
      'colors.2': 3
      'colors.2.hex': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'colors.0'
      2: 'colors.1.hex'
      3: 'colors.2'
      4: 'colors.2.hex'
    }
    expect(pathMap.arrays).to.eql {
      colors: [
        {1: ''}
        {2: '.hex'}
        {3: '', 4: '.hex'}
      ]
    }

  it 'onMove should update single nested array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'tables.0.rows.0').to.eql 1
    expect(pathMap.id 'tables.0.rows.1.name').to.eql 2
    expect(pathMap.id 'tables.1.rows.0').to.eql 3
    expect(pathMap.id 'tables.2.rows.0.name').to.eql 4

    pathMap.onMove 'tables.0.rows', 0, 1, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.name': 2
      'tables.0.rows.1': 1
      'tables.1.rows.0': 3
      'tables.2.rows.0.name': 4
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.name'
      1: 'tables.0.rows.1'
      3: 'tables.1.rows.0'
      4: 'tables.2.rows.0.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {2: '.name'}
        {1: ''}
      ]
      'tables.1.rows': [
        {3: ''}
      ]
      'tables.2.rows': [
        {4: '.name'}
      ]
    }

    pathMap.onMove 'tables.0.rows', 1, 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0': 1
      'tables.0.rows.1.name': 2
      'tables.1.rows.0': 3
      'tables.2.rows.0.name': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0'
      2: 'tables.0.rows.1.name'
      3: 'tables.1.rows.0'
      4: 'tables.2.rows.0.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {1: ''}
        {2: '.name'}
      ]
      'tables.1.rows': [
        {3: ''}
      ]
      'tables.2.rows': [
        {4: '.name'}
      ]
    }

    pathMap.onMove 'tables', 0, 1, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0': 3
      'tables.1.rows.0': 1
      'tables.1.rows.1.name': 2
      'tables.2.rows.0.name': 4
    }
    expect(pathMap.paths).to.eql {
      3: 'tables.0.rows.0'
      1: 'tables.1.rows.0'
      2: 'tables.1.rows.1.name'
      4: 'tables.2.rows.0.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {3: ''}
      ]
      'tables.1.rows': [
        {1: ''}
        {2: '.name'}
      ]
      'tables.2.rows': [
        {4: '.name'}
      ]
    }

    pathMap.onMove 'tables', 1, 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0': 1
      'tables.0.rows.1.name': 2
      'tables.1.rows.0': 3
      'tables.2.rows.0.name': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0'
      2: 'tables.0.rows.1.name'
      3: 'tables.1.rows.0'
      4: 'tables.2.rows.0.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {1: ''}
        {2: '.name'}
      ]
      'tables.1.rows': [
        {3: ''}
      ]
      'tables.2.rows': [
        {4: '.name'}
      ]
    }

    pathMap.onMove 'tables', 2, 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.name': 4
      'tables.1.rows.0': 1
      'tables.1.rows.1.name': 2
      'tables.2.rows.0': 3
    }
    expect(pathMap.paths).to.eql {
      4: 'tables.0.rows.0.name'
      1: 'tables.1.rows.0'
      2: 'tables.1.rows.1.name'
      3: 'tables.2.rows.0'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {4: '.name'}
      ]
      'tables.1.rows': [
        {1: ''}
        {2: '.name'}
      ]
      'tables.2.rows': [
        {3: ''}
      ]
    }

    pathMap.onMove 'tables', 0, 2, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0': 1
      'tables.0.rows.1.name': 2
      'tables.1.rows.0': 3
      'tables.2.rows.0.name': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0'
      2: 'tables.0.rows.1.name'
      3: 'tables.1.rows.0'
      4: 'tables.2.rows.0.name'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {1: ''}
        {2: '.name'}
      ]
      'tables.1.rows': [
        {3: ''}
      ]
      'tables.2.rows': [
        {4: '.name'}
      ]
    }

  it 'onMove should update double nested array indicies', ->
    pathMap = new PathMap
    expect(pathMap.id 'tables.0.rows.0.cols.0').to.eql 1
    expect(pathMap.id 'tables.0.rows.1.cols.0.text').to.eql 2
    expect(pathMap.id 'tables.1.rows.0.cols.0').to.eql 3
    expect(pathMap.id 'tables.2.rows.0.cols.0.text').to.eql 4

    pathMap.onMove 'tables.0.rows', 0, 1, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0.text': 2
      'tables.0.rows.1.cols.0': 1
      'tables.1.rows.0.cols.0': 3
      'tables.2.rows.0.cols.0.text': 4
    }
    expect(pathMap.paths).to.eql {
      2: 'tables.0.rows.0.cols.0.text'
      1: 'tables.0.rows.1.cols.0'
      3: 'tables.1.rows.0.cols.0'
      4: 'tables.2.rows.0.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{2: '.text'}]
      'tables.0.rows.1.cols': [{1: ''}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{3: ''}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{4: '.text'}]
    }

    pathMap.onMove 'tables.0.rows', 1, 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0': 1
      'tables.0.rows.1.cols.0.text': 2
      'tables.1.rows.0.cols.0': 3
      'tables.2.rows.0.cols.0.text': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0.cols.0'
      2: 'tables.0.rows.1.cols.0.text'
      3: 'tables.1.rows.0.cols.0'
      4: 'tables.2.rows.0.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{1: ''}]
      'tables.0.rows.1.cols': [{2: '.text'}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{3: ''}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{4: '.text'}]
    }

    pathMap.onMove 'tables', 0, 1, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0': 3
      'tables.1.rows.0.cols.0': 1
      'tables.1.rows.1.cols.0.text': 2
      'tables.2.rows.0.cols.0.text': 4
    }
    expect(pathMap.paths).to.eql {
      3: 'tables.0.rows.0.cols.0'
      1: 'tables.1.rows.0.cols.0'
      2: 'tables.1.rows.1.cols.0.text'
      4: 'tables.2.rows.0.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{3: ''}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{1: ''}]
      'tables.1.rows.1.cols': [{2: '.text'}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{4: '.text'}]
    }

    pathMap.onMove 'tables', 1, 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0': 1
      'tables.0.rows.1.cols.0.text': 2
      'tables.1.rows.0.cols.0': 3
      'tables.2.rows.0.cols.0.text': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0.cols.0'
      2: 'tables.0.rows.1.cols.0.text'
      3: 'tables.1.rows.0.cols.0'
      4: 'tables.2.rows.0.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{1: ''}]
      'tables.0.rows.1.cols': [{2: '.text'}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{3: ''}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{4: '.text'}]
    }

    pathMap.onMove 'tables', 2, 0, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0.text': 4
      'tables.1.rows.0.cols.0': 1
      'tables.1.rows.1.cols.0.text': 2
      'tables.2.rows.0.cols.0': 3
    }
    expect(pathMap.paths).to.eql {
      4: 'tables.0.rows.0.cols.0.text'
      1: 'tables.1.rows.0.cols.0'
      2: 'tables.1.rows.1.cols.0.text'
      3: 'tables.2.rows.0.cols.0'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{4: '.text'}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{1: ''}]
      'tables.1.rows.1.cols': [{2: '.text'}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{3: ''}]
    }

    pathMap.onMove 'tables', 0, 2, 1
    expect(pathMap.ids).to.eql {
      'tables.0.rows.0.cols.0': 1
      'tables.0.rows.1.cols.0.text': 2
      'tables.1.rows.0.cols.0': 3
      'tables.2.rows.0.cols.0.text': 4
    }
    expect(pathMap.paths).to.eql {
      1: 'tables.0.rows.0.cols.0'
      2: 'tables.0.rows.1.cols.0.text'
      3: 'tables.1.rows.0.cols.0'
      4: 'tables.2.rows.0.cols.0.text'
    }
    expect(pathMap.arrays).to.eql {
      'tables': [
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
        {arrays: {'.rows': true}}
      ]
      'tables.0.rows': [
        {arrays: {'.cols': true}}
        {arrays: {'.cols': true}}
      ]
      'tables.0.rows.0.cols': [{1: ''}]
      'tables.0.rows.1.cols': [{2: '.text'}]
      'tables.1.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.1.rows.0.cols': [{3: ''}]
      'tables.2.rows': [
        {arrays: {'.cols': true}}
      ]
      'tables.2.rows.0.cols': [{4: '.text'}]
    }
