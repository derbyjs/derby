# Troubleshooting

This guide covers common issues that you may run into as you use Derby. Feel free to contribute your own troubleshooting experience! :)

## Attaching bindings failed, because HTML structure does not match client rendering

When the page is loaded on the browser, the following error might be thrown in the console:

```
Attaching bindings failed, because HTML structure does not match client rendering
```

... along with the problematic view that is causing this issue. It can be tricky to understand what caused the error if you touched a bunch of files at the same time (JS, HTML, CSS) and being unsure what caused the problem in the first place. Turns out, it's always about the HTML structure.

When the page is rendered server side and is sent down to the client, Derby it will ensure that both HTML structures are exactly the same before attaching. If they don't match that is usually because the browser's parser attempts to gracefully handle invalid HTML that you may have introduced by mistake. For example, the following syntax is valid XML syntax but invalid HTML:

```html
<p>
  <div>
  </div>
</p>
```

Browsers will effectively turn this into:

```html
<p></p>
<div></div>
```

... according to the HTML rules set by W3:

> The P element represents a paragraph. It cannot contain block-level elements (including P itself). We discourage authors from using empty P elements. User agents should ignore empty P elements.

source: https://www.w3.org/TR/html401/struct/text.html#edef-P

The same goes for HTML tables where:

```html
<table>
  <td></td>
</table>
```

... may be rendered by a browser as:

```html
<table>
  <tbody>
    <tr>
      <td></td>
    </tr>
  </tbody>
</table>
```

There are many other ways where parsers will try to "fix" invalid HTML and cause Derby to fail attaching.

Here are a few common possibilities:
* invalid HTML (as illustrated above)
* sorting lists on in `init()` might cause the output to be non-deterministic (like alphabetizing / capitalization). Basically a data "bug" would end-up generated different HTML.
* putting links in links, which has undefined behavior in HTML
* inserting a conditional `<div>` such as `{{if thisIsTrue}}<div>stuff</div>{{/if}}` without restarting the server
