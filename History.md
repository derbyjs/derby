# Derby change history

Racer provides the model and data synchronization for Derby. It's versions are updated along with Derby versions. See change history for Racer as well:
https://github.com/codeparty/racer/blob/master/History.md

## 0.3.11
- Emit 'render', 'render:{ns}', 'replace', and 'replace:{ns}' events on an app when the page is rendered client-side
- Call x-bind functions with `this` set to the app or component object
- Support prototype-like definition of component methods for more efficient creation of component instances
- More careful delaying of component creation method calls instead of using setTimeout
- Fix bug in lookup of templates from an inherited namespace
- Fix bug when binding to a view helper function inside of an each and later updating array indicies
- Fix bugs in component path binding lookup

## 0.3.10
- Fix bugs with Browserify 1.13.0 and Express 3.0.0 beta 3
- Fix bugs in components
- Can pass JSON object literals to component attributes
- Fix bug with Safari binding to comment markers

## 0.3.9
- Set the 'this' context of the ready callback to the app
- Add model and params as a property of Page objects passed to routes
- Use chokidar instead of fs.watch

## 0.3.8
- Create a component librarary by default in the generated app
- Fix Windows bugs. Windows should now work
- Improvements to file watch reliability in development
- Fix bugs parsing template files and comments

## 0.3.7
- Make apps and components into event emitters
- Fix bugs with creating components
- Emit 'create:child', 'create:descendant', 'create:{name}' events for components
- Support passing function names to x-bind via macro template tags
- Fix lots of bugs in components

## 0.3.6
- Start to implement components that have associated script files
- Refactoring

## 0.3.5
- Fix bug introduced in 0.3.4

## 0.3.4
- Bug fixes with macro tags

## 0.3.3
- Convert to JS
- Refactor into separate npm modules for routing (tracks), HTML utilities (html-util), and DOM fixes (dom-shim)
