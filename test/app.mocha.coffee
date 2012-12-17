{expect, calls} = require 'racer/test/util'
app = require '../lib/app'

describe 'App', ->

  it 'merges a tree into an empty object', ->
    root = {}
    fn = ->
    tree =
      x:
        a: 23
        b: fn
      y: 12

    app.treeMerge root, tree
    expect(root).not.equal tree
    expect(root).eql tree

  it 'merges a tree into a non-empty object', ->
    fn2 = ->
    root =
      x:
        c: fn2
        d:
          n: 2
      z: 23
    fn = ->
    tree =
      x:
        a: 7
        b: fn
      y: 12

    expected =
      x:
        a: 7
        b: fn
        c: fn2
        d:
          n: 2
      y: 12
      z: 23
    app.treeMerge root, tree
    expect(root).not.equal expected
    expect(root).eql expected
