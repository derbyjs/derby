{expect, calls} = require 'racer/test/util'
fs = require "fs"
files = require "../lib/files"
derby = require "../lib/derby"


describe 'files.css', ->

  it "should compile less", (done) ->
    derby.configure "all", ->
      derby.set "styles", "less"
    expected = fs.readFileSync __dirname + "/fixtures/styles/app/expected.less.css", 'utf8'

    files.css __dirname + "/fixtures", "app", false, (err, contents) ->
      # nextTick because stylus.render catches assertions
      process.nextTick ->
        expect(contents).to.equal expected
        done()

  it "should compile stylus", (done) ->
    derby.configure "all", ->
      derby.set "styles", ["stylus"]
    expected = fs.readFileSync __dirname + "/fixtures/styles/app/expected.styl.css", 'utf8'

    files.css __dirname + "/fixtures", "app", false, (err, contents) ->
      process.nextTick ->
        expect(contents).to.equal expected
        done()
