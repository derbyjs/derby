{expect, calls} = require 'racer/test/util'
fs = require "fs"
files = require "../src/files"

describe 'files.css', ->
  it "should compile less", (done) ->
    expected = fs.readFileSync __dirname + "/fixtures/styles/app/expected.css", 'utf8'

    files.css __dirname + "/fixtures", "app", false, (err, contents) ->
      console.log(err)
      expect(contents).to.equal expected
      done()
