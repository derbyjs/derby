# Derby change history

Racer provides the model and data synchronization for Derby. It's versions are updated along with Derby versions. See change history for Racer as well:
https://github.com/codeparty/racer/blob/master/History.md

## 0.3.14
This release includes a great deal of work making components and templating more full featured and performant

- Instead of macro template tags with triple curly braces, such as {{{items}}}, attributes passed to components are now accessed with an @ sign, such as {{@items}} or {@items}
- <derby:view view="example"> syntax is now supported for including components with a variable name. This is equivalent to <app:example>, but the view attribute can vary based on context
- Components can be passed an `inherit` attribute to default to the attributes from the parent
- View#fn syntax has changed to support more arbitrary inputs and outputs. See the docs for more detail
- Instead of view.dom, it is now app.view, app.dom, app.history, and app.model in the client
- Add View#componentsByName
- Bindings don't update during route execution for faster page renders
- Initial support for bindings within inline SVG elements
- Components have a 'destroy' event that gets invoked when they are no longer in the DOM
- Components automatically cleanup listeners added via dom.addListener and model.on within a component
- App#fn can be used to add controller methods to the app more easily across different files
- App auto-reloading no longer uses Up, which didn't work well with polling. Reloading now uses cluster, though it is still somewhat buggy
- App#enter and App#exit added, which get called upon entering or exiting a particular route pattern. Can be used intead of App#ready, which only gets called on the very first page load
- Add Component#setup for more easy access to the library within a given components code. Useful for adding view functions pertaining to a particular component
- App#Collection added for more convenient access to scoped models in controller functions and definition of collection specific methods. Demonstrated in the leaderboard code of the Sink example.
- e.path(), e.get(), and e.at() now available for using template-style path names in controller code. Often more flexible and convenient than using model.at(el)
- Many bug fixes

## 0.3.13
Mostly just bug fixes

- Add Component#emitDelayable()
- Fix options specification to be more consistent
- Add staticMount option
- Lots of bug fixes

## 0.3.12
The API for creating stores and sessions has changed in support of adding auth. Generating a new starter server via `derby new` is recommended

- There is no longer an app.createStore() method, and the derby.createStore() method must be used in combination with the store.modelMiddleware(). There is now a req.getModel() method added by the modelMiddleware. 
- Bugs in bracketed path interpolation in templates have been fixed, and the syntax has been updated to work more like javascript property accessors. The syntax is now `<h1>{users[_userId].name}</h1>`
- The component type is now passed as a second argument to init and create events instead of being available as a property of the component. Within the same library, the namespaces is now correctly sent as 'lib:'
- Add `log` and `path` view helper functions for debugging
- Support binding the same event to multiple space-separated function names in `x-bind`
- Set the value of component macro attributes to true when no value is specified for more easy HTML boolean style flags
- Fix a bug where using multiple apps would cause the page to reload continuously
- Default project now requires Express beta 4, since beta 6 breaks Gzippo
- Fix lots of other bugs

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
