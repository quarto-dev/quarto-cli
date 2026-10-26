# @quarto/external-d3-d3-require: a fork of https://github.com/d3/d3-require

This fork changes d3-require to work better in the presence of other javascript importers that might hijack window.define.
This comes up in [quarto](https://quarto.org) specifically when using Jupyter's HTMLWidgets.

# d3-require

A minimal, promise-based implementation to require [asynchronous module definitions](https://github.com/amdjs/amdjs-api/blob/master/AMD.md) (AMD). This implementation is [small](https://github.com/d3/d3-require/blob/main/src/index.mjs) and supports a strict subset of AMD. It is designed to work with browser-targeting libraries that implement one of the [recommended UMD patterns](https://github.com/umdjs/umd). The constraints of this implementation are:

* The `define` method must be called synchronously by the library on load.

* Only the built-in `exports` and `module` dependencies are allowed; no `require` as in CommonJS. The `module` entry only contains an `exports` property.

* Named module definitions (*e.g.*, jQuery) are treated as anonymous modules.

By default, [d3.require](#require) loads modules from [jsDelivr](https://jsdelivr.com/); the module *name* can be any package (or scoped package) name optionally followed by the at sign (@) and a semver range. For example, `d3.require("d3@5")` loads the highest version of [D3](https://d3js.org) 5.x. Relative paths and absolute URLs are also supported. You can change this behavior using [d3.requireFrom](#requireFrom).

## Installing

If you use NPM, `npm install d3-require`. Otherwise, download the [latest release](https://github.com/d3/d3-require/releases/latest). You can also load directly from [jsDelivr](https://www.jsdelivr.com/package/npm/d3-require). AMD, CommonJS, and vanilla environments are supported. In vanilla, `d3` and `define` globals are exported:

```html
<script src="https://cdn.jsdelivr.net/npm/d3-require@1"></script>
<script>

d3.require("d3-array").then(d3 => {
  console.log(d3.range(100));
});

</script>
```

## API Reference

<a href="#require" name="require">#</a> d3.<b>require</b>(<i>names…</i>) [<>](https://github.com/d3/d3-require/blob/main/src/index.mjs "Source")

To load a module:

```js
d3.require("d3-array").then(d3 => {
  console.log(d3.range(100));
});
```

To load a module within a version range:

```js
d3.require("d3-array@1").then(d3 => {
  console.log(d3.range(100));
});
```

To load two modules and merge them into a single object:

```js
d3.require("d3-array", "d3-color").then(d3 => {
  console.log(d3.range(360).map(h => d3.hsl(h, 1, 0.5)));
});
```

Note: if more than one *name* is specified, the promise will yield a new object with each of the loaded module’s own enumerable property values copied into the new object. If multiple modules define the same property name, the value from the latest module that defines the property is used; it is recommended that you only combine modules that avoid naming conflicts.

If a module’s property value is null or undefined on load, such as [d3.event](https://github.com/d3/d3-selection/blob/main/README.md#event), the value will be exposed via [getter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) rather than copied; this is to simulate ES module-style [live bindings](http://2ality.com/2015/07/es6-module-exports.html). However, property values that are neither null nor undefined on load are copied by value assignment, and thus **are not live bindings**!

<a href="#requireFrom" name="requireFrom">#</a> d3.<b>requireFrom</b>(<i>resolver</i>) [<>](https://github.com/d3/d3-require/blob/main/src/index.mjs "Source")

Returns a new [require function](#require) which loads modules from the specified *resolver*, which is a function that takes a module name and returns the corresponding URL. For example:

```js
const myRequire = d3.requireFrom(async name => {
  return `https://unpkg.com/${name}`;
});

myRequire("d3-array").then(d3 => {
  console.log(d3.range(100));
});
```

The returned *require* function exposes the passed in *resolver* as [*require*.resolve](#require_resolve). See also [resolveFrom](#resolveFrom).

<a href="#require_resolve" name="require_resolve">#</a> <i>require</i>.<b>resolve</b>(<i>name</i>[, <i>base</i>]) [<>](https://github.com/d3/d3-require/blob/main/src/index.mjs "Source")

Returns a promise to the URL to load the module with the specified *name*. The *name* may also be specified as a relative path, in which case it is resolved relative to the specified *base* URL. If *base* is not specified, it defaults to the global [location](https://developer.mozilla.org/en-US/docs/Web/API/Window/location).

<a href="#require_alias" name="require_alias">#</a> <i>require</i>.<b>alias</b>(<i>aliases</i>) [<>](https://github.com/d3/d3-require/blob/main/src/index.mjs "Source")

Returns a [require function](#require) with the specified *aliases*. For each key in the specified *aliases* object, any require of that key is substituted with the corresponding value. The values can be strings representing the name or URL of the module to load, or a literal non-string value for direct substitution. For example, if `React` and `ReactDOM` are already in-scope, you can say:

```js
const myRequire = d3.require.alias({
  "react": React,
  "react-dom": ReactDOM
});

myRequire("semiotic").then(Semiotic => {
  console.log(Semiotic);
});
```

<a href="#resolveFrom" name="resolveFrom">#</a> d3.<b>resolveFrom</b>(<i>origin</i>, <i>mains</i>) [<>](https://github.com/d3/d3-require/blob/main/src/index.mjs "Source")

Returns a new [resolver function](#require_resolve) which loads modules from the specified *origin* and observes the specified *mains* entry points.  The returned function can be passed to [requireFrom](#requireFrom). For example:

```js
const myResolve = d3.resolveFrom(`https://unpkg.com/${name}`);
const myRequire = d3.requireFrom(myResolve);
```

<a href="#RequireError" name="RequireError">#</a> d3.<b>RequireError</b>

The class of error that may be thrown by require.
