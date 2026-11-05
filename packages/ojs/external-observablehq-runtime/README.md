# @observablehq/runtime

[![Node CI](https://github.com/observablehq/runtime/workflows/Node%20CI/badge.svg)](https://github.com/observablehq/runtime/actions?workflow=Node+CI) [![Greenkeeper badge](https://badges.greenkeeper.io/observablehq/runtime.svg)](https://greenkeeper.io/)

The [Observable runtime](https://observablehq.com/@observablehq/how-observable-runs) lets you run Observable notebooks as true reactive programs [in any JavaScript environment](https://observablehq.com/@observablehq/downloading-and-embedding-notebooks): on your personal website, integrated into your web application or interactive dashboard. Take your notebook to any distant shore the web platform reaches.

For example, to render the “hello” cell from the [“Hello World” notebook](https://observablehq.com/@observablehq/hello-world):

```html
<!DOCTYPE html>
<meta charset="utf-8">
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/@observablehq/inspector@5/dist/inspector.css">
<body>
<script type="module">

import {Runtime, Inspector} from "https://cdn.jsdelivr.net/npm/@observablehq/runtime@5/dist/runtime.js";
import define from "https://api.observablehq.com/@observablehq/hello-world.js?v=4";

const runtime = new Runtime();
const main = runtime.module(define, name => {
  if (name === "hello") {
    const node = document.createElement("DIV");
    document.body.appendChild(node);
    return new Inspector(node);
  }
});

</script>
```

To render the entire notebook into the body, use [Inspector.into](https://github.com/observablehq/inspector/blob/master/README.md#Inspector_into):

```js
const runtime = new Runtime();
const main = runtime.module(define, Inspector.into(document.body));
```

For more control, implement a [custom observer](#observers) in place of the standard inspector. The returned object may implement [*observer*.pending](#observer_pending), [*observer*.fulfilled](#observer_fulfilled) and [*observer*.rejected](#observer_rejected) methods to be notified when the corresponding *variable* changes state. For example:

```js
const runtime = new Runtime();
const main = runtime.module(define, name => {
  return {
    pending() {
      console.log(`${name}: pending`);
    },
    fulfilled(value) {
      console.log(`${name}: fullfilled`, value);
    },
    rejected(error) {
      console.error(`${name}: rejected`, error);
    }
  };
});
```

Variables which are not associated with an *observer*, or aren’t indirectly depended on by a variable that is associated with an *observer*, will not be evaluated. To force a variable to be evaluated, return true. See [*module*.variable](#module_variable).

## API Reference

### Runtimes

<a href="#Runtime" name="Runtime">#</a> new <b>Runtime</b>(<i>builtins</i> = new Library[, <i>global</i>]) [<>](https://github.com/observablehq/runtime/blob/master/src/runtime.js "Source")

Returns a new [runtime](#runtimes). If *builtins* is specified, each property on the *builtins* object defines a builtin variable for the runtime. These builtins are available as named inputs to any [defined variables](#variable_define) on any [module](#modules) associated with this runtime. If *builtins* is not specified, it defaults to the [standard library](https://github.com/observablehq/stdlib/blob/master/README.md). If a *global* function is specified, it will be invoked with the name of any unresolved reference, and must return the corresponding value or undefined (to trigger a ReferenceError); if *global* is not specified, unresolved values will be resolved from the global window.

Many Observable notebooks rely on the [standard library](https://github.com/observablehq/stdlib) builtins. To instead specify a custom set of builtins:

```js
const runtime = new Runtime({color: "red"});
```

Or to define a new builtin, or override an existing one:

```js
const runtime = new Runtime(Object.assign(new Library, {color: "red"}));
```

To refer to the `color` builtin from a variable:

```js
const module = runtime.module();
const inspector = new Inspector(document.querySelector("#hello"));
module.variable(inspector).define(["color"], color => `Hello, ${color}.`);
```

This would produce the following output:

> Hello, red.

Unlike [variables](#variables), builtins cannot depend on the value of other variables or builtins; they are defined with no inputs. If a builtin is defined as a function, it will be invoked lazily to determine the value of the builtin. If you wish for the value of a builtin to be a function, the builtin must be defined either as a promise that resolves to a function or as a function that returns a function. Builtins may also be defined as generators for dynamic values; see [now](https://github.com/observablehq/stdlib/blob/master/README.md#now) for example.

<a href="#runtime_module" name="runtime_module">#</a> <i>runtime</i>.<b>module</b>([<i>define</i>][, <i>observer</i>]) [<>](https://github.com/observablehq/runtime/blob/master/src/runtime.js "Source")

Returns a new [module](#modules) for this [runtime](#runtimes).

If *define* is specified, it is a function which defines the new module’s [variables](#variables) by calling *runtime*.module (with no arguments) and then calling [*module*.variable](#module_variable) on the returned module as desired. If this runtime already has a module for the specified *define* function, the existing module is returned; otherwise, a new module is created, and the *define* function is called, being passed this runtime and the specified *observer* factory function. If *define* is not specified, a new module is created and returned.

If an *observer* factory function is specified, it is called for each named variable in the returned module, being passed the variable’s name. The [standard inspector](#inspector) is available as a ready-made observer: it displays DOM elements “as-is” and renders interactive displays for other arbitrary values such as numbers and objects.

<a href="#runtime_dispose" name="runtime_dispose">#</a> <i>runtime</i>.<b>dispose</b>() [<>](https://github.com/observablehq/runtime/blob/master/src/runtime.js "Source")

Disposes this runtime, invalidating all active variables and disabling future computation.

### Modules

A module is a namespace for [variables](#variables); within a module, variables should typically have unique names. [Imports](#variable_import) allow variables to be referenced across modules.

<a href="#module_variable" name="module_variable">#</a> <i>module</i>.<b>variable</b>([<i>observer</i>]) [<>](https://github.com/observablehq/runtime/blob/master/src/module.js "Source")

Returns a new [variable](#variables) for this [module](#modules). The variable is initially undefined.

If *observer* is specified, the specified [observer](#observers) will be notified when the returned variable changes state, via the [observer.*pending*](#observer_pending), [observer.*fulfilled*](#observer_fulfilled) and [observer.*rejected*](#observer_rejected) methods. See the [standard inspector](https://github.com/observablehq/inspector/blob/master/README.md) for a convenient default observer implementation.

A variable without an associated *observer* is only computed if any transitive output of the variable has an *observer*; variables are computed on an as-needed basis for display. This is particularly useful when the runtime has multiple modules (as with [imports](#variable_import)): only the needed variables from imported modules are computed.

<a href="#module_derive" name="module_derive">#</a> <i>module</i>.<b>derive</b>(<i>specifiers</i>, <i>source</i>) [<>](https://github.com/observablehq/runtime/blob/master/src/module.js "Source")

Returns a derived copy of this [module](#modules), where each variable in *specifiers* is replaced by an [import](#variable_import) from the specified *source* module. The *specifiers* are specified as an array of objects with the following properties:

* *specifier*.name - the name of the variable to import from *source*.
* *specifier*.alias - the name of the variable to redefine in this module.

If *specifier*.alias is not specified, it defaults to *specifier*.name. A *specifier* may also be specified as a string, in which case the string is treated as both the name and the alias. For example, consider the following module which defines two constants *a* and *b*, and a variable *c* that represents their sum:

```js
const module0 = runtime.module();
module0.variable().define("a", 1);
module0.variable().define("b", 2);
module0.variable().define("c", ["a", "b"], (a, b) => a + b);
```

To derive a new module that redefines *b*:

```js
const module1 = runtime.module();
const module1_0 = module0.derive(["b"], module1);
module1.variable().define("b", 3);
module1.variable().import("c", module1_0);
```

The value of *c* in the derived module is now 1 + 3 = 4, whereas the value of *c* in the original module remains 1 + 2 = 3.

<a href="#module_define" name="module_define">#</a> <i>module</i>.<b>define</b>(\[<i>name</i>, \]\[<i>inputs</i>, \]<i>definition</i>) [<>](https://github.com/observablehq/runtime/blob/master/src/module.js "Source")

A convenience method for [*variable*.define](#variable_define); equivalent to:

```js
module.variable().define(name, inputs, definition)
```

<a href="#module_import" name="module_import">#</a> <i>module</i>.<b>import</b>(<i>name</i>, [<i>alias</i>, ]<i>from</i>) [<>](https://github.com/observablehq/runtime/blob/master/src/module.js "Source")

A convenience method for [*variable*.import](#variable_import); equivalent to:

```js
module.variable().import(name, alias, from)
```

<a href="#module_redefine" name="module_redefine">#</a> <i>module</i>.<b>redefine</b>(<i>name</i>[, <i>inputs</i>], <i>definition</i>) [<>](https://github.com/observablehq/runtime/blob/master/src/module.js "Source")

Redefines the *variable* with the specified *name* on this module. If no such variable exists, or if more than one variable has the specified *name*, throws a runtime error.

<a href="#module_value" name="module_value">#</a> <i>module</i>.<b>value</b>(<i>name</i>) [<>](https://github.com/observablehq/runtime/blob/master/src/module.js "Source")

Returns a promise to the next value of the *variable* with the specified *name* on this module. If no such variable exists, or if more than one variable has the specified *name*, throws a runtime error.

### Variables

A variable defines a piece of state in a reactive program, akin to a cell in a spreadsheet. Variables may be named to allow the definition of derived variables: variables whose value is computed from other variables’ values. Variables are scoped by a [module](#modules) and evaluated by a [runtime](#runtimes).

<a href="#variable_define" name="variable_define">#</a> <i>variable</i>.<b>define</b>(\[<i>name</i>, \]\[<i>inputs</i>, \]<i>definition</i>) [<>](https://github.com/observablehq/runtime/blob/master/src/variable.js "Source")

Redefines this variable to have the specified *name*, taking the variables with the names specified in *inputs* as arguments to the specified *definition* function. If *name* is null or not specified, this variable is anonymous and may not be referred to by other variables. The named *inputs* refer to other variables (possibly [imported](#variable_import)) in this variable’s module. Circular inputs are not allowed; the variable will throw a ReferenceError upon evaluation. If *inputs* is not specified, it defaults to the empty array. If *definition* is not a function, the variable is defined to have the constant value of *definition*.

The *definition* function may return a promise; derived variables will be computed after the promise resolves. The *definition* function may likewise return a generator; the runtime will pull values from the generator on every animation frame, or if the generator yielded a promise, after the promise is resolved. When the *definition* is invoked, the value of `this` is the variable’s previous value, or undefined if this is the first time the variable is being computed under its current definition. Thus, the previous value is preserved only when input values change; it is *not* preserved if the variable is explicitly redefined.

For example, consider the following module that starts with a single undefined variable, *a*:

```js
const runtime = new Runtime(builtins);

const module = runtime.module();

const a = module.variable();
```

To define variable *a* with the name `foo` and the constant value 42:

```js
a.define("foo", 42);
```

This is equivalent to:

```js
a.define("foo", [], () => 42);
```

To define an anonymous variable *b* that takes `foo` as input:

```js
const b = module.variable();

b.define(["foo"], foo => foo * 2);
```

This is equivalent to:

```js
b.define(null, ["foo"], foo => foo * 2);
```

Note that the JavaScript symbols in the above example code (*a* and *b*) have no relation to the variable names (`foo` and null); variable names can change when a variable is redefined or deleted. Each variable corresponds to a cell in an Observable notebook, but the cell can be redefined to have a different name or definition.

If more than one variable has the same *name* at the same time in the same module, these variables’ definitions are temporarily overridden to throw a ReferenceError. When and if the duplicate variables are [deleted](#variable_delete), or are redefined to have unique names, the original definition of the remaining variable (if any) is restored. For example, here variables *a* and *b* will throw a ReferenceError:

```js
const module = new Runtime(builtins).module();
const a = module.variable().define("foo", 1);
const b = module.variable().define("foo", 2);
```

If *a* or *b* is redefined to have a different name, both *a* and *b* will subsequently resolve to their desired values:

```js
b.define("bar", 2);
```

Likewise deleting *a* or *b* would allow the other variable to resolve to its desired value.

<a href="#variable_import" name="variable_import">#</a> <i>variable</i>.<b>import</b>(<i>name</i>, [<i>alias</i>, ]<i>module</i>) [<>](https://github.com/observablehq/runtime/blob/master/src/variable.js "Source")

Redefines this variable as an alias of the variable with the specified *name* in the specified [*module*](#modules). The subsequent name of this variable is the specified *name*, or if specified, the given *alias*. The order of arguments corresponds to the standard import statement: `import {name as alias} from "module"`. For example, consider a module which defines a variable named `foo`:

```js
const runtime = new Runtime(builtins);

const module0 = runtime.module();

module0.variable().define("foo", 42);
```

To import `foo` into another module:

```js
const module1 = runtime.module();

module1.variable().import("foo", module0);
```

Now the variable `foo` is available to other variables in *module1*:

```js
module1.variable().define(["foo"], foo => `Hello, ${foo}.`);
```

This would produce the following output:

> Hello, 42.

To import `foo` into *module1* under the alias `bar`:

```js
module1.variable().import("foo", "bar", module0);
```

<a href="#variable_delete" name="variable_delete">#</a> <i>variable</i>.<b>delete</b>() [<>](https://github.com/observablehq/runtime/blob/master/src/variable.js "Source")

Deletes this variable’s current definition and name, if any. Any variable in this module that references this variable as an input will subsequently throw a ReferenceError. If exactly one other variable defined this variable’s previous name, such that that variable throws a ReferenceError due to its duplicate definition, that variable’s original definition is restored.

### Observers

An observer watches a [variable](#variables), being notified via asynchronous callback whenever the variable changes state. See the [standard inspector](https://github.com/observablehq/inspector) for reference.

<a href="#observer_pending" name="observer_pending">#</a> <i>observer</i>.<b>pending</b>()

Called shortly before the variable is computed. For a generator variable, this occurs before the generator is constructed, but not before each subsequent value is pulled from the generator.

<a href="#observer_fulfilled" name="observer_fulfilled">#</a> <i>observer</i>.<b>fulfilled</b>(<i>value</i>)

Called shortly after the variable is fulfilled with a new *value*.

<a href="#observer_rejected" name="observer_rejected">#</a> <i>observer</i>.<b>rejected</b>(<i>error</i>)

Called shortly after the variable is rejected with the given *error*.

### Library

For convenience, this module re-exports the [Observable standard library](https://github.com/observablehq/stdlib).

### Inspector

For convenience, this module re-exports the [Observable standard inspector](https://github.com/observablehq/inspector).
