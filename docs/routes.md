---
layout: default
title: Routes
---

# Routes

Routes map URL patterns to actions. Derby routes are powered by [Express](https://expressjs.com/). Within apps, routes are defined via the `get`, `post`, `put`, and `del` methods of the app created by `derby.createApp()`.

> `app.get ( routePattern, callback(page, model, params, next) )`
>
> `app.post ( routePattern, callback(page, model, params, next) )`
>
> `app.put ( routePattern, callback(page, model, params, next) )`
>
> `app.del ( routePattern, callback(page, model, params, next) )`
>
> * `pattern`: A string containing a literal URL, an Express route pattern, or a regular expression. See [Express's routing documentation](https://expressjs.com/guide/routing.html) for more info.
>
> * `callback`: Function invoked when a request for a URL matching the appropriate HTTP method and pattern is received. Note that this function is called both on the server and the client.
>
> * `page`: Object with the methods [`page.render()`](#page) and `page.redirect()`. All app routes should call one of these two methods or pass control by calling `next()`.
>
> * `model`: Derby model object
>
> * `params`: An object containing the matching URL parameters. The `url`, `query`, and `body` properties typically available on `req` are also added to this object.
>
> * `next`: A function that can be called to pass control to the next matching route. If this is called on the client, control will be passed to the next route defined in the app. If no other routes in the same app match, it will fall through to a server request.

Express is used directly on the server. On the client, Derby includes Express's route matching module. When a link is clicked or a form is submitted, Derby first tries to render the new URL on the client. AJAX requests will still go directly to the server.

Derby can also capture form submissions client-side. It provides support for `post`, `put`, and `del` HTTP methods using the same hidden form field [override approach](https://expressjs.com/guide.html#http-methods) as Express.

## Page

Unlike Express, which provides direct access to the `req` and `res` objects created by Node HTTP servers, Derby returns a `page` object. This provide the same interface on the client and the server, so that route handlers may be executed in both environments.

> `page.render ( viewName )`
>
> * `viewName`: The name of the view to render, see [Namespaces and files](./views/namespaces-and-files) for more details.
>
>
> `page.renderStatic ( statusCode, content )`
>
> * `statusCode`: The HTTP status code to return.
>
> * `content`: A string of HTML to render
>
> `page.redirect ( url, [status] )`
>
> * `url`: Destination of redirect. [Like Express][expressRedirect], may also be the string 'home' (which redirects to '/') or 'back' (which goes back to the previous URL).
>
> * `status`: *(optional)* Number specifying HTTP status code. Defaults to 302 on the server. Has no effect on the client.

[expressRedirect]: https://expressjs.com/guide.html#res.redirect()


### Middleware

It is possible to directly use [express middleware](https://expressjs.com/guide/using-middleware.html) and get access to a [Racer model](./models#methods).


## History

For the most part, updating the URL client-side should be done with normal HTML links. The default action of requesting a new page from the server is canceled automatically if the app has a route that matches the new URL.

To update the URL after an action other than clicking a link, scripts can call methods on `app.history`. For example, an app might update the URL as the user scrolls and the page loads more content from a paginated list.

> `app.history.push ( url, [render], [state], [e] )`
>
> `app.history.replace ( url, [render], [state], [e] )`
>
> * `url`: New URL to set for the current window
>
> * `render`: *(optional)* Re-render the page after updating the URL if true. Defaults to true
>
> * `state`: *(optional)* A state object to pass to the `window.history.pushState` or `window.history.replaceState` method. `$render` and `$method` properties are added to this object for internal use when handling `popstate` events
>
> * `e`: *(optional)* An event object whose `stopPropogation` method will be called if the URL can be rendered client-side

Derby's `history.push` and `history.replace` methods will update the URL via `window.history.pushState` or `window.history.replaceState`, respectively. They will fall back to setting `window.location` and server-rendering the new URL if a browser does not support these methods. The `push` method is used to update the URL and create a new entry in the browser's back/forward history. The `replace` method is used to only update the URL without creating an entry in the back/forward history.

> `app.history.refresh ( )`
>
> Re-render the current URL client-side

For convenience, the navigational methods of [`window.history`](https://developer.mozilla.org/en/DOM/window.history) can also be called on `app.history`.

> `app.history.back ( )`
>
> * Call `window.history.back()`, which is equivalent to clicking the browser's back button

> `view.history.forward ( )`
>
> * Call `window.history.forward()`, which is equivalent to clicking the browser's forward button

> `view.history.go ( i )`
>
> * Call `window.history.go()`
>
> * `i`: An integer specifying the number of times to go back or forward. Navigates back if negative or forward if positive
