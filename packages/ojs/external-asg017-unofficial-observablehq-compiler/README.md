# unofficial-observablehq-compiler

An unoffical compiler _and_ interpreter for Observable notebooks (the glue between the Observable parser and runtime)

This library has two parts: The Interpreter and the Compiler. The Interpreter will interpret "Observable syntax" into "javascript syntax" live in a javascript environment. For example:

```javascript
import { Intepreter } from "@alex.garcia/unofficial-observablehq-compiler";
import { Inspector, Runtime } from "@observablehq/runtime";

async function main() {
  const runtime = new Runtime();
  const main = runtime.module();
  const observer = Inspector.into(document.body);
  const interpret = new Intepreter({ module: main, observer });

  await interpret.module(`
import {text} from '@jashkenas/inputs'

viewof name = text({
  title: "what's your name?",
  value: ''
})

md\`Hello **\${name}**, it's nice to meet you!\`

`);
}
main();
```

The Compiler will compile "Observable syntax" into javascript source code (as an ES module).

For more live examples and functionality, take a look at the [announcement notebook](https://observablehq.com/d/74f872c4fde62e35)
and this [test page](https://github.com/asg017/unofficial-observablehq-compiler/blob/master/test/test.html).

## API Reference

### new Interpreter(_params_)

`Interpreter` is a class that encompasses all logic to interpret Observable js code. _params_ is an optional object with the following allowed configuration:

`resolveImportPath(path, specifers)`: An async function that resolves to the `define` definition for a notebook. _path_ is the string provided in the import statement, and _specifiers_ is a array of string if the imported cell name specifiers in the statement (cells inside `import {...}`). _specifiers_ is useful when implementing tree-shaking. For example, `import {chart as CHART} from "@d3/bar-chart"` would supply `path="@d3/bar-chart"` and `specifiers=["chart"]`. Default imports from observablehq.com, eg `https://api.observablehq.com/@d3/bar-chart.js?v=3`
`resolveFileAttachments`: A function that, given the name of a FileAttachment, returns the URL that the FileAttachment will be fetched from. Defaults to `name => name`.
`defineImportMarkdown`: A boolean, whether to define a markdown description cell for imports in the notebook. Defaults true.
`observeViewofValues`: A boolean, whether to pass in an _observer_ for the value of viewof cells.
`module`: A default Observable runtime [module](https://github.com/observablehq/runtime#modules) that will be used in operations such as `.cell` and `.module`, if no other module is passed in.
`observer`: A default Observable runtime [observer](https://github.com/observablehq/runtime#observer) that will be used in operations such as `.cell` and `.module`, if no other observer is passed in.

Keep in mind, there is no sandboxing done, so it has the same security implications as `eval()`.

interpret.**cell**(_source_ [, *module*, *observer*])

Parses the given string _source_ with the Observable parser [`.parseCell()`](https://github.com/observablehq/parser#parseCell) and interprets the source, passing it and the _observer_ along to the Observable _module_. Returns a Promise that resolves to an array of runtime [variables](https://github.com/observablehq/runtime#variables) that were defined when interpreting the source. More than one variable can be defined with a single cell, like with `viewof`, `mutable`, and `import` cells. _source_ can also be a pre-parsed [cell](https://github.com/observablehq/parser#cell) instead of source code.

interpret.**module**(_source_ [, *module*, *observer*])

Parses the given string _source_ with the Observable parser [`.parseModule()`](https://github.com/observablehq/parser#parseModule) and interprets the source, passing it and the _observer_ along to the Observable _module_. Returns a Promise that resolves to an array of an array of runtime [variables](https://github.com/observablehq/runtime#variables) that were defined when interpreting the source. _source_ can also be a pre-parsed [program](https://github.com/observablehq/parser#program) instead of source code.

interpret.**notebook**(_source_ [, *module*, *observer*])

TODO

new **Compiler**(_params_)

`Compiler` is a class that encompasses all logic to compile Observable javascript code into vanilla Javascript code, as an ES module. _params_ is an optional object with the following allowed configuration.

`resolveImportPath(path, specifers)`: A function that returns a URL to where the notebook is defined. _path_ is the string provided in the import statement, and _specifiers_ is a array of string if the imported cell name specifiers in the statement (cells inside `import {...}`). _specifiers_ is useful when implementing tree-shaking. For example, `import {chart as CHART} from "@d3/bar-chart"` would supply `path="@d3/bar-chart"` and `specifiers=["chart"]`. Default imports from observablehq.com, eg `https://api.observablehq.com/@d3/bar-chart.js?v=3`

`resolveFileAttachments`: A function that, given the name of a FileAttachment, returns the URL that the FileAttachment will be fetched from. Defaults to `name => name`.

`UNSAFE_allowJavascriptFileAttachments` A boolean. When true, the `resolveFileAttachments` function will resolve to raw JavaScript when calculating the value of a FileAttachment reference. This is useful if you need to use `new URL` or `import.meta.url` when determining where a FileAttachment url should resolve too. This is unsafe because the Compiler will not escape any quotes when including it in the compiled output, so do use with extreme caution when dealing with user input.

```javascript

// This can be unsafe since FileAttachment names can include quotes.
// Instead, map file attachments names to something deterministic and escape-safe,
// like SHA hashes.
const resolveFileAttachments = name => `new URL("./files/${name}", import.meta.url)`

Compiled output when:

// UNSAFE_allowJavascriptFileAttachments == false
const fileAttachments = new Map([["a", "new URL(\"./files/a\", import.meta.url)"]]);

// UNSAFE_allowJavascriptFileAttachments == true
const fileAttachments = new Map([["a", new URL("./files/a", import.meta.url)]]);


```

`defineImportMarkdown` - A boolean, whether to define a markdown description cell for imports in the notebook. Defaults true.

`observeViewofValues` - A boolean, whether or not to pass in the `observer` function for viewof value cells. Defaults true.

`observeMutableValues` - A boolean, whether or not to pass in the `observer` function for mutable value cells. Defaults true.

compile.**module**(_source_)

TODO

compile.**notebook**(_source_)

TODO

## License

This library is MIT, but it relies and gets heavy inspiration from the following
libraries licensed under ISC:

- [@observablehq/runtime](https://github.com/observablehq/runtime)
- [@observablehq/stdlib](https://github.com/observablehq/stdlib)
- [@observablehq/inspector](https://github.com/observablehq/inspector)
- [@observablehq/parser](https://github.com/observablehq/parser)

## Contributing

Feel free to send in PR's as you wish! Take a look at the [issues](https://github.com/asg017/unofficial-observablehq-compiler/issues)
to find something to work on. Just please follow the [Contributor Covenant](https://www.contributor-covenant.org/)
in all your interactions :smile:
