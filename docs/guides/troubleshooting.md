---
layout: default
title: Troubleshooting
parent: Guides
---

# Troubleshooting

This guide covers common issues that you may run into as you use Derby. Feel free to contribute your own troubleshooting experience! :)

## Attaching bindings failed, because HTML structure does not match client rendering

When the page is loaded on the browser, the following error might be thrown in the console:

```
Attaching bindings failed, because HTML structure does not match client rendering
```

... along with the problematic view that is causing this issue. It can be tricky to understand what caused the error if you touched a bunch of files at the same time (JS, HTML, CSS) and being unsure what caused the problem in the first place. Turns out, it's always about the HTML structure.

When the page is rendered server side and is sent down to the client, Derby it will ensure that both HTML structures are exactly the same before attaching. If they don't match that is usually because the browser's parser attempts to gracefully handle invalid HTML that you may have introduced by mistake. For example, the following syntax is valid XML syntax but invalid HTML:

```jinja
<p>
  <div>
  </div>
</p>
```

Browsers will effectively turn this into:

```jinja
<p></p>
<div></div>
```

... according to the HTML rules set by W3:

> The P element represents a paragraph. It cannot contain block-level elements (including P itself). We discourage authors from using empty P elements. User agents should ignore empty P elements.

source: https://www.w3.org/TR/html401/struct/text.html#edef-P

The same goes for HTML tables where:

```jinja
<table>
  <td></td>
</table>
```

... may be rendered by a browser as:

```jinja
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

## Error when attempting to use local model paths in singleton components

A [singleton component](../components/lifecycle#singleton-stateless-components) does not have a local model, so trying to use a local model path like `{{value}}` in its view will fail with this error:

```
TypeError: Cannot read properties of undefined (reading 'data')
  at PathExpression.get
  ...
```

To resolve the issue, bind the data via an attribute and refer to it with an attribute path `{{@value}}`. See the linked singleton component documentation for an example.

Alternatively, if you don't need component controller functions, switch to using a plain [view partial](../components/view-partials) instead.

## Mutation on uncreated remote document

To perform mutations on a DB-backed document, it must first be loaded in the model. If not, an error `Error: Mutation on uncreated remote document` will be thrown.

There are a few ways to load a document into the model:
- [Fetching or subscribing to the document](../models/backends#loading-data-into-a-model), either directly via doc id or via a query
- Creating a new document, e.g. via `model.add()`

When a document is loaded with a [projection](https://share.github.io/sharedb/projections), the mutation must be done using the same projection name.
- For example, if a doc was loaded only with a projection name `model.fetch('notes_title.note-12')`, then mutations must be done with the projection name, `model.set('notes_title.note-12.title', 'Intro')`.
- Trying to mutate using the base collection name in that case, `model.set('notes.note-12.title')`, will result in the "Mutation on uncreated remote document" error.
- If a doc is loaded both with the base collection name and with projections, then mutations can be done with any collection or projection name the doc was loaded with.

## Invalid op submitted. Operation invalid in projected collection

Make sure the field being mutated is one of the fields defined in the [projection](https://share.github.io/sharedb/projections).

If that's not feasible, then fetch/subscribe the doc using its base collection name and do the mutation using the base collection.
