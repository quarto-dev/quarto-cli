import {Runtime} from "@observablehq/runtime";
import assert from "assert";
import {identity} from "../../src/identity.js";
import {valueof, promiseInspector, sleep} from "./valueof.js";

it("module.derive(overrides, module) injects variables into a copied module", async () => {
  const runtime = new Runtime();
  const module0 = runtime.module();
  const a0 = module0.variable(true).define("a", [], () => 1);
  const b0 = module0.variable(true).define("b", [], () => 2);
  const c0 = module0.variable(true).define("c", ["a", "b"], (a, b) => a + b);
  const module1 = runtime.module();
  const module1_0 = module0.derive([{name: "d", alias: "b"}], module1);
  const c1 = module1_0.variable(true).define(null, ["c"], c => c);
  const d1 = module1.define("d", [], () => 42);
  assert.deepStrictEqual(await valueof(a0), {value: 1});
  assert.deepStrictEqual(await valueof(b0), {value: 2});
  assert.deepStrictEqual(await valueof(c0), {value: 3});
  assert.deepStrictEqual(await valueof(c1), {value: 43});
  assert.deepStrictEqual(await valueof(d1), {value: 42});
});

it("module.derive(…) copies module-specific builtins", async () => {
  const runtime = new Runtime();
  const module0 = runtime.module();
  module0.builtin("a", 1);
  const b0 = module0.variable(true).define("b", ["a"], a => a + 1);
  const module1_0 = module0.derive([], module0);
  const c1 = module1_0.variable(true).define("c", ["a"], a => a + 2);
  assert.deepStrictEqual(await valueof(b0), {value: 2});
  assert.deepStrictEqual(await valueof(c1), {value: 3});
});

it("module.derive(…) can inject into modules that inject into modules", async () => {
  const runtime = new Runtime();

  // Module A
  // a = 1
  // b = 2
  // c = a + b
  const A = runtime.module();
  A.define("a", 1);
  A.define("b", 2);
  A.define("c", ["a", "b"], (a, b) => a + b);

  // Module B
  // d = 3
  // import {c as e} with {d as b} from "A"
  const B = runtime.module();
  B.define("d", 3);
  const BA = A.derive([{name: "d", alias: "b"}], B);
  B.import("c", "e", BA);

  // Module C
  // f = 4
  // import {e as g} with {f as d} from "B"
  const C = runtime.module();
  C.define("f", 4);
  const CB = B.derive([{name: "f", alias: "d"}], C);
  const g = C.variable(true).import("e", "g", CB);

  assert.deepStrictEqual(await valueof(g), {value: 5});
  assert.strictEqual(g._module, C);
  assert.strictEqual(g._inputs[0]._module, CB);
  assert.strictEqual(g._inputs[0]._inputs[0]._module._source, BA);
  assert.strictEqual(C._source, null);
  assert.strictEqual(CB._source, B);
  assert.strictEqual(BA._source, A);
});

it("module.derive(…) can inject into modules that inject into modules that inject into modules", async () => {
  const runtime = new Runtime();

  // Module A
  // a = 1
  // b = 2
  // c = a + b
  const A = runtime.module();
  A.define("a", 1);
  A.define("b", 2);
  A.define("c", ["a", "b"], (a, b) => a + b);

  // Module B
  // d = 3
  // import {c as e} with {d as b} from "A"
  const B = runtime.module();
  B.define("d", 3);
  const BA = A.derive([{name: "d", alias: "b"}], B);
  B.import("c", "e", BA);

  // Module C
  // f = 4
  // import {e as g} with {f as d} from "B"
  const C = runtime.module();
  C.define("f", 4);
  const CB = B.derive([{name: "f", alias: "d"}], C);
  C.import("e", "g", CB);

  // Module D
  // h = 5
  // import {g as i} with {h as f} from "C"
  const D = runtime.module();
  D.define("h", 5);
  const DC = C.derive([{name: "h", alias: "f"}], D);
  const i = D.variable(true).import("g", "i", DC);

  assert.deepStrictEqual(await valueof(i), {value: 6});
  assert.strictEqual(i._module, D);
  assert.strictEqual(i._inputs[0]._module, DC);
  assert.strictEqual(i._inputs[0]._module._source, C);
  assert.strictEqual(i._inputs[0]._inputs[0]._module._source, CB);
  assert.strictEqual(i._inputs[0]._inputs[0]._module._source._source, B);
});

it("module.derive(…) does not copy non-injected modules", async () => {
  const runtime = new Runtime();

  // Module A
  // a = 1
  // b = 2
  // c = a + b
  const A = runtime.module();
  A.define("a", 1);
  A.define("b", 2);
  A.define("c", ["a", "b"], (a, b) => a + b);

  // Module B
  // import {c as e} from "A"
  const B = runtime.module();
  B.import("c", "e", A);

  // Module C
  // f = 4
  // import {e as g} with {f as d} from "B"
  const C = runtime.module();
  C.define("f", 4);
  const CB = B.derive([{name: "f", alias: "d"}], C);
  const g = C.variable(true).import("e", "g", CB);

  assert.deepStrictEqual(await valueof(g), {value: 3});
  assert.strictEqual(g._module, C);
  assert.strictEqual(g._inputs[0]._module, CB);
  assert.strictEqual(g._inputs[0]._inputs[0]._module, A);
});

it("module.derive(…) does not copy non-injected modules, again", async () => {
  const runtime = new Runtime();
  const A = runtime.module();
  A.define("a", () => ({}));
  const B = runtime.module();
  B.import("a", A);
  const C = runtime.module();
  const CB = B.derive([], C);
  const a1 = C.variable(true).import("a", "a1", CB);
  const a2 = C.variable(true).import("a", "a2", A);
  const {value: v1} = await valueof(a1);
  const {value: v2} = await valueof(a2);
  assert.deepStrictEqual(v1, {});
  assert.strictEqual(v1, v2);
});

it("module.derive() supports lazy import-with", async () => {
  let resolve2, promise2 = new Promise((resolve) => resolve2 = resolve);

  function define1(runtime, observer) {
    const main = runtime.module();
    main.define("module 1", ["@variable"], async (v) => runtime.module(await promise2).derive([{name: "b"}], v._module));
    main.define("c", ["module 1", "@variable"], (_, v) => v.import("c", _));
    main.variable(observer("b")).define("b", [], () => 3);
    main.variable(observer("imported c")).define("imported c", ["c"], c => c);
    return main;
  }

  function define2(runtime, observer) {
    const main = runtime.module();
    main.variable(observer("a")).define("a", [], () => 1);
    main.variable(observer("b")).define("b", [], () => 2);
    main.variable(observer("c")).define("c", ["a", "b"], (a, b) => a + b);
    return main;
  }

  const runtime = new Runtime();
  const inspectorC = promiseInspector();
  runtime.module(define1, name => {
    if (name === "imported c") {
      return inspectorC;
    }
  });

  await sleep();
  resolve2(define2);
  assert.deepStrictEqual(await inspectorC, 4);
});

it("module.derive() supports lazy transitive import-with", async () => {
  let resolve2, promise2 = new Promise((resolve) => resolve2 = resolve);
  let resolve3, promise3 = new Promise((resolve) => resolve3 = resolve);
  let module2_1;
  let module3_2;
  let variableC_1;

  // Module 1
  // b = 4
  // imported c = c
  // import {c} with {b} from "2"
  function define1(runtime, observer) {
    const main = runtime.module();
    main.define("module 2", ["@variable"], async (v) => (module2_1 = runtime.module(await promise2).derive([{name: "b"}], v._module)));
    variableC_1 = main.define("c", ["module 2", "@variable"], (_, v) => v.import("c", _));
    main.variable(observer("b")).define("b", [], () => 4);
    main.variable(observer("imported c")).define("imported c", ["c"], c => c);
    return main;
  }

  // Module 2
  // b = 3
  // c
  // import {c} with {b} from "3"
  function define2(runtime, observer) {
    const main = runtime.module();
    main.define("module 3", ["@variable"], async (v) => (module3_2 = runtime.module(await promise3).derive([{name: "b"}], v._module)));
    main.define("c", ["module 3", "@variable"], (_, v) => v.import("c", _));
    main.variable(observer("b")).define("b", [], () => 3);
    main.variable(observer()).define(["c"], c => c);
    return main;
  }

  // Module 3
  // a = 1
  // b = 2
  // c = a + b
  function define3(runtime, observer) {
    const main = runtime.module();
    main.variable(observer("a")).define("a", [], () => 1);
    main.variable(observer("b")).define("b", [], () => 2);
    main.variable(observer("c")).define("c", ["a", "b"], (a, b) => a + b);
    return main;
  }

  const runtime = new Runtime();
  const inspectorC = promiseInspector();
  runtime.module(define1, name => {
    if (name === "imported c") {
      return inspectorC;
    }
  });

  // Initially c in module 1 is not an import; it’s a placeholder that depends
  // on an internal variable called “module 2”. Also, only one module yet
  // exists, because module 2 has not yet loaded.
  await sleep();
  const module1 = runtime.module(define1);
  const c1 = module1._scope.get("c");
  assert.strictEqual(c1, variableC_1);
  assert.deepStrictEqual(c1._inputs.map(i => i._name), ["module 2", "@variable"]);
  assert.strictEqual(runtime._modules.size, 1);

  // After module 2 loads, the variable c in module 1 has been redefined; it is
  // now an import of c from a derived copy of module 2, module 2'. In addition,
  // the variable b in module 2' is now an import from module 1.
  resolve2(define2);
  await sleep();
  const module2 = runtime.module(define2);
  assert.deepStrictEqual(c1._inputs.map(i => i._name), ["c"]);
  assert.strictEqual(c1._definition, identity);
  assert.strictEqual(c1._inputs[0]._module, module2_1);
  assert.strictEqual(module2_1._source, module2);
  assert.strictEqual(runtime._modules.size, 2);
  const b2_1 = module2_1._scope.get("b");
  assert.deepStrictEqual(b2_1._inputs.map(i => i._name), ["b"]);
  assert.deepStrictEqual(b2_1._definition, identity);
  assert.deepStrictEqual(b2_1._inputs[0]._module, module1);

  // After module 3 loads, the variable c in module 2' has been redefined; it is
  // now an import of c from a derived copy of module 3, module 3'. In addition,
  // the variable b in module 3' is now an import from module 2'.
  resolve3(define3);
  await sleep();
  const module3 = runtime.module(define3);
  const c2_1 = module2_1._scope.get("c");
  assert.strictEqual(c2_1._module, module2_1);
  assert.strictEqual(c2_1._definition, identity);
  assert.strictEqual(c2_1._inputs[0]._module, module3_2);
  assert.strictEqual(module3_2._source, module3);
  const b3_2 = module3_2._scope.get("b");
  assert.deepStrictEqual(b3_2._inputs.map(i => i._name), ["b"]);
  assert.deepStrictEqual(b3_2._definition, identity);
  assert.deepStrictEqual(b3_2._inputs[0]._module, module2_1);
  assert.deepStrictEqual(await inspectorC, 5);
});
