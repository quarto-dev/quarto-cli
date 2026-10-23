const test = require("tape");
const { Runtime } = require("@observablehq/runtime");
const { Compiler } = require("../dist/index");

test("Compiler: simple", async t => {
  const compile = new Compiler();
  const runtime = new Runtime();

  const src = compile.module(`a = 1; b = 2; c = a + b;
  d = {yield 1; yield 2; yield 3;}; e = await Promise.resolve(40);`);

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("a")).define("a", function(){return(
1
)});
  main.variable(observer("b")).define("b", function(){return(
2
)});
  main.variable(observer("c")).define("c", ["a","b"], function(a,b){return(
a + b
)});
  main.variable(observer("d")).define("d", function*()
{yield 1; yield 2; yield 3;}
);
  main.variable(observer("e")).define("e", async function(){return(
await Promise.resolve(40)
)});
  return main;
}`
  );
  const define = eval(`(${src.substring("export default ".length)})`);
  const main = runtime.module(define);

  t.equals(await main.value("a"), 1);
  t.equals(await main.value("b"), 2);
  t.equals(await main.value("c"), 3);
  t.equals(await main.value("d"), 1);
  t.equals(await main.value("e"), 40);

  t.end();
});

test("Compiler: viewof cells", async t => {
  const compile = new Compiler();
  const runtime = new Runtime();

  const src = compile.module(
    `viewof a = ({name: 'alex', value: 101, addEventListener: () => {} })`
  );

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("viewof a")).define("viewof a", function(){return(
{name: 'alex', value: 101, addEventListener: () => {} }
)});
  main.variable(observer("a")).define("a", ["Generators", "viewof a"], (G, _) => G.input(_));
  return main;
}`
  );
  const define = eval(`(${src.substring("export default ".length)})`);
  const main = runtime.module(define);

  t.equals(await main.value("a"), 101);

  t.end();
});

test("Compiler: mutable cells", async t => {
  const compile = new Compiler();
  const runtime = new Runtime();

  const src = compile.module(`mutable a = 200; _ = (mutable a = 202)`);

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.define("initial a", function(){return(
200
)});
  main.variable(observer("mutable a")).define("mutable a", ["Mutable", "initial a"], (M, _) => new M(_));
  main.variable(observer("a")).define("a", ["mutable a"], _ => _.generator);
  main.variable(observer("_")).define("_", ["mutable a"], function($0){return(
$0.value = 202
)});
  return main;
}`
  );
  const define = eval(`(${src.substring("export default ".length)})`);
  const main = runtime.module(define);

  t.equals(await main.value("a"), 200);
  t.equals(await main.value("_"), 202);
  t.equals(await main.value("a"), 202);

  t.end();
});

test("Compiler: import cells", async t => {
  const compile = new Compiler({
    resolveImportPath: (name, specifiers) =>
      `https://example.com/${name}?${specifiers
        .map(s => `specifiers=${encodeURIComponent(s)}`)
        .join("&")}`
  });

  const src = compile.module(`import {a as A, b as B, c as C} from "alpha";`);

  t.equal(
    src,
    `import define1 from "https://example.com/alpha?specifiers=a&specifiers=b&specifiers=c";

export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer()).define(
    null,
    ["md"],
    md => md\`~~~javascript
import {a as A, b as B, c as C} from "alpha"
~~~\`
  );
  const child1 = runtime.module(define1);
  main.import("a", "A", child1);
  main.import("b", "B", child1);
  main.import("c", "C", child1);
  return main;
}`
  );

  t.end();
});

// defineImportMarkdown
test("Compiler: defineImportMarkdown", async t => {
  let compile = new Compiler({ defineImportMarkdown: true });
  let src = compile.module(`import {a} from "whatever";`);

  t.equal(
    src,
    `import define1 from "https://api.observablehq.com/whatever.js?v=3";

export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer()).define(
    null,
    ["md"],
    md => md\`~~~javascript
import {a as a} from "whatever"
~~~\`
  );
  const child1 = runtime.module(define1);
  main.import("a", "a", child1);
  return main;
}`
  );

  compile = new Compiler({ defineImportMarkdown: false });
  src = compile.module(`import {a} from "whatever";`);
  t.equal(
    src,
    `import define1 from "https://api.observablehq.com/whatever.js?v=3";

export default function define(runtime, observer) {
  const main = runtime.module();

  const child1 = runtime.module(define1);
  main.import("a", "a", child1);
  return main;
}`
  );

  t.end();
});

// observeViewofValues
test("Compiler: observeViewofValues", async t => {
  let compile = new Compiler({ observeViewofValues: true });
  let src = compile.module(
    "viewof a = ({value: 100, addEventListener: () => {}, removeEventListener: () => {}})"
  );

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("viewof a")).define("viewof a", function(){return(
{value: 100, addEventListener: () => {}, removeEventListener: () => {}}
)});
  main.variable(observer("a")).define("a", ["Generators", "viewof a"], (G, _) => G.input(_));
  return main;
}`
  );

  compile = new Compiler({ observeViewofValues: false });
  src = compile.module(
    "viewof a = ({value: 100, addEventListener: () => {}, removeEventListener: () => {}})"
  );

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("viewof a")).define("viewof a", function(){return(
{value: 100, addEventListener: () => {}, removeEventListener: () => {}}
)});
  main.variable(null).define("a", ["Generators", "viewof a"], (G, _) => G.input(_));
  return main;
}`
  );

  t.end();
});

test("Compiler: observeMutableValues", async t => {
  let compile = new Compiler({ observeMutableValues: true });
  let src = compile.module("mutable a = 0x100");

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.define("initial a", function(){return(
0x100
)});
  main.variable(observer("mutable a")).define("mutable a", ["Mutable", "initial a"], (M, _) => new M(_));
  main.variable(observer("a")).define("a", ["mutable a"], _ => _.generator);
  return main;
}`
  );

  compile = new Compiler({ observeMutableValues: false });
  src = compile.module("mutable a = 0x100");

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.define("initial a", function(){return(
0x100
)});
  main.variable(observer("mutable a")).define("mutable a", ["Mutable", "initial a"], (M, _) => new M(_));
  main.variable(null).define("a", ["mutable a"], _ => _.generator);
  return main;
}`
  );

  t.end();
});

test("Compiler: resolveFileAttachments", async t => {
  function resolveFileAttachments(name) {
    return `https://example.com/${name}`;
  }
  let compile = new Compiler({ resolveFileAttachments });
  let src = compile.module('a = FileAttachment("a")');

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();
  const fileAttachments = new Map([["a","https://example.com/a"]]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer("a")).define("a", ["FileAttachment"], function(FileAttachment){return(
FileAttachment("a")
)});
  return main;
}`
  );

  t.end();
});

test("Compiler: resolveFileAttachments UNSAFE_allowJavascriptFileAttachments", async t => {
  function resolveFileAttachments(name) {
    return `new URL("./path/to/${name}", import.meta.url)`;
  }
  let compile = new Compiler({
    resolveFileAttachments,
    UNSAFE_allowJavascriptFileAttachments: true
  });
  let src = compile.module('a = FileAttachment("a")');

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();
  const fileAttachments = new Map([["a", new URL("./path/to/a", import.meta.url)]]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer("a")).define("a", ["FileAttachment"], function(FileAttachment){return(
FileAttachment("a")
)});
  return main;
}`
  );

  t.end();
});

test("Compiler: treeShake", async t => {
  let src;
  const initSrc = `
  viewof a = html\`<input type=range>\`; b = 2; c = a + b;
  d = 2; e = 4; f = d + e;
  height = c;
  import {chart} with {height} from "@d3/bar-chart";`;
  const compile = new Compiler({ defineImportMarkdown: false });

  src = compile.module(initSrc, {
    treeShake: ["f"]
  });

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("d")).define("d", function(){return(
2
)});
  main.variable(observer("e")).define("e", function(){return(
4
)});
  main.variable(observer("f")).define("f", ["d","e"], function(d,e){return(
d + e
)});
  return main;
}`
  );

  src = compile.module(initSrc, {
    treeShake: ["f", "a"]
  });

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("viewof a")).define("viewof a", ["html"], function(html){return(
html\`<input type=range>\`
)});
  main.variable(observer("a")).define("a", ["Generators", "viewof a"], (G, _) => G.input(_));
  main.variable(observer("d")).define("d", function(){return(
2
)});
  main.variable(observer("e")).define("e", function(){return(
4
)});
  main.variable(observer("f")).define("f", ["d","e"], function(d,e){return(
d + e
)});
  return main;
}`
  );

  src = compile.module(initSrc, {
    treeShake: ["chart"]
  });

  t.equal(
    src,
    `import define1 from "https://api.observablehq.com/@d3/bar-chart.js?v=3";

export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("viewof a")).define("viewof a", ["html"], function(html){return(
html\`<input type=range>\`
)});
  main.variable(observer("a")).define("a", ["Generators", "viewof a"], (G, _) => G.input(_));
  main.variable(observer("b")).define("b", function(){return(
2
)});
  main.variable(observer("c")).define("c", ["a","b"], function(a,b){return(
a + b
)});
  main.variable(observer("height")).define("height", ["c"], function(c){return(
c
)});
  const child1 = runtime.module(define1).derive([{"name":"height","alias":"height"}], main);
  main.import("chart", "chart", child1);
  return main;
}`
  );

  // make sure tree shaking an unreference cell just returns a define identity function.
  t.equals(
    compile.module(`a = 1; b = a/1;`, { treeShake: ["c"] }),
    `export default function define(runtime, observer) {
  const main = runtime.module();


  return main;
}`
  );

  t.end();
});

test("Compiler: multiple refs", async t => {
  const compile = new Compiler();
  const runtime = new Runtime();

  const src = compile.module(`a = 1; b = a,a,a,a;`);

  t.equal(
    src,
    `export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("a")).define("a", function(){return(
1
)});
  main.variable(observer("b")).define("b", ["a"], function(a){return(
a,a,a,a
)});
  return main;
}`
  );
  const define = eval(`(${src.substring("export default ".length)})`);
  const main = runtime.module(define);

  t.equals(await main.value("a"), 1);
  t.equals(await main.value("b"), 1);

  t.end();
});
