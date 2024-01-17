---
layout: default
title: Operators
parent: Template syntax
grand_parent: Views
---

# Operators

All non-assigment JavaScript operators and using parentheses for grouping expressions are supported. They work exactly the same as they do in Javascript. Operators that do an assignment, such as the `++` increment operator, are not supported. This avoids rendering having side effects.

```derby
<!-- Negate -->
{{-value}}
<!-- Convert to number -->
{{+value}}

<!-- Add -->
{{left + right}}
<!-- Subtract -->
{{left - right}}
<!-- Multiply -->
{{left * right}}
<!-- Divide -->
{{left / right}}
<!-- Modulo -->
{{left % right}}

<!-- Logical NOT -->
{{!value}}
<!-- Logical OR -->
{{left || right}}
<!-- Logical AND -->
{{left && right}}

<!-- Bitwise NOT -->
{{~value}}
<!-- Bitwise OR -->
{{left | right}}
<!-- Bitwise AND -->
{{left & right}}
<!-- Bitwise XOR -->
{{left ^ right}}

<!-- Bitwise left shift -->
{{left << right}}
<!-- Bitwise right shift -->
{{left >> right}}
<!-- Bitwise unsigned right shift -->
{{left >>> right}}

<!-- Strict equality -->
{{left === right}}
<!-- Strict inequality -->
{{left !== right}}
<!-- Loose equality -->
{{left == right}}
<!-- Loose inequality -->
{{left != right}}

<!-- Less than -->
{{left < right}}
<!-- Greater than -->
{{left > right}}
<!-- Less than or equal -->
{{left <= right}}
<!-- Greater than or equal -->
{{left >= right}}

<!-- Determine type -->
{{typeof value}}
<!-- Determine if object is an instance of another object -->
{{left instanceof right}}
<!-- Determine if object has a property -->
{{left in right}}

<!-- Conditional -->
{{test ? consequent : alternate}}

<!-- Sequence -->
{{a, b, c, d}}
```

## Two-way operators

In addition to getting values, operators for which there is a well defined opposite support two-way data bindings. These setters will make the relationship consistent with the value that is set.

```derby
<!-- The not operator works both on getting and setting -->
<label>
  <input type="checkbox" checked="{{!showDetails}}"> Hide details
</label>

<!--
  When set to true, the equality operator will set the left side to be the
  same value as the right side. When set to false, it will do nothing. This
  enables the following pattern for radio buttons:
-->
{{each options as #option}}
  <label>
    <input type="radio" checked="{{activeId === #option.id}}"> {{#option.text}}
  </label>
{{/each}}
```
