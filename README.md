# Derby

Derby is a reactive MVC framework for writing realtime applications in Node.js. It leverages [Racer](https://github.com/codeparty/racer) to automatically sync model data among clients and servers, and it uses logic-less templates automatically create bindings betweeen the model and view.

Derby not only makes creating interactive realtime applications easier, it also makes them load as fast as a static web page. Most traditional web frameworks, such as Rails, Django, and PHP, render pages on the server. This makes pages load fast but complicates adding interactivity in the browser. Often, code written with these frameworks eventually turns into a mess of complex, interdependent server code that renders an initial state and jQuery, Prototype, etc. code that manipulates that state in the browser.

To avoid this problem, most dynamic web application frameworks, such as SproutCore, YUI, Dojo, Google Closure, GWT, etc., structure applications to run entirely in the browser. In this architecture, the server mostly sends resources and data back and forth. This makes writing complex apps a lot easier, but it also means that as a code base becomes more complex, page loads get slower and slower. It also can make it difficult for search engines to index such pages.

Racer and Derby are both designed to run the same code equally well on the server and client from the get-go. This means that applications are rendered into HTML on the server and also include the code to update the page as things change in realtime. Thus, pages load quickly, provide immediate interaction, and continue to work offline.

## Disclaimer

Neither Derby nor Racer are ready for use, so **please do not report bugs or contribute pull requests yet**. Lots of the code is being actively rewritten, and the API is likely to change substantially.

If you have feedback, ideas, or suggestions, feel free to leave them on the [wiki](https://github.com/codeparty/derby/wiki). If you are interested in contributing, please reach out to [Brian](https://github.com/bnoguchi) and [Nate](https://github.com/nateps) first.

## Demos

### Chat

http://chat.derbyjs.com/lobby

A very simple chat demo. Note that as you edit your name, it updates in realtime. Check out the source in the examples directory to see how these bindings are created automatically.

## Usage

Like, Racer, Derby is not fully baked yet. It only has the basic structure and enough specifics to handle the chat demo. More will come soon!

