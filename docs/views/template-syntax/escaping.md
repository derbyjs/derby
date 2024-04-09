---
layout: default
title: Escaping
parent: Template syntax
grand_parent: Views
---

# Escaping

Derby escapes values as required when it renders HTML. Escaping is relative to whether it is rendering inside of an HTML attribute or text. For example, Derby will escape `"` as `&quot;` inside of an HTML attribute, and it will escape `<` as `&lt;` inside of text.

Derby's templates also follow HTML escaping rules. Derby will parse the string `{{` as the start of a template tag, so if you wish to write this value in an attribute or the text of a Derby template, you can use the HTML entity equivalent: `&#123;&#123;`.

## Rendering unescaped HTML

The `unescaped` keyword may be used to render an HTML string without escaping. It is *very unlikely* that you should use this feature. Derby has many ways of dynamically creating views. Unescaped HTML is unsafe, is typically slower, and is rarely necessary with Derby. This feature is intended only for rendering the output of a well-tested library that produces sanitized HTML, such as [Google Caja](https://developers.google.com/caja/).

```derby
<!-- WARNING: Avoid unescaped HTML. This is supported, but not recommended -->
<div>{{unescaped rawHtml}}</div>
```

Instead, prefer passing in a template as an attribute or dynamically selecting a view in most cases.

```derby
<!-- Typically, it is possible to pass templates to a view as an attribute -->
<Body:>
  <view is="user-card" user-id="{{_session.userId}}">
    <b>Custom HTML for this user!</b>
  </view>

<user-card:>
  <div class="user-card">
    <img src="{{users[@userId].imageUrl}}">
    {{@content}}
  </div>
```

```derby
<!-- Or select which view to render dynamically by name -->
<view is="cards-{{cardType}}"></view>
```

If you need completely dynamic generation of HTML (such as implementing an HTML or template editor in your application), it is even possible to use Derby's HTML parser and pass the returned Template object to your views. Derby will render this HTML safely without any Cross-site Scripting (XSS) concerns. You'll even be able to use Derby's template syntax! See how this is done in the [Derby render example](https://github.com/derbyjs/derby-examples/blob/master/render/index.js#L29), which powers the live template editor on the [DerbyJS home page](https://derbyjs.com/).
