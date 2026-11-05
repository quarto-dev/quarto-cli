const test = require("tape");
const { Interpreter } = require("../dist/index");
const { Runtime, RuntimeError } = require("@observablehq/runtime");

test("Interpreter: simple cells", async t => {
  const interpret = new Interpreter();
  const runtime = new Runtime();
  const main = runtime.module();
  let observer = () => null;

  const a = await interpret.cell("a = 1", main, observer);

  t.equals(await main.value("a"), 1);
  t.equals(a.length, 1);
  t.equals(a[0]._module, main);
  t.equals(a[0]._value, 1);

  await interpret.module("b = 2; c = a + b;", main, observer);

  t.equals(await main.value("b"), 2);
  t.equals(await main.value("c"), 3);

  await interpret.module(
    "d = {yield 1; yield 2; yield 3;}; e = await Promise.resolve(40);",
    main,
    observer
  );

  t.equals(await main.value("d"), 1);
  t.equals(await main.value("e"), 40);

  try {
    await main.value("x");
    t.fail();
  } catch (error) {
    t.equal(error.constructor, RuntimeError);
  }

  t.end();
});

test("Interpreter: viewof cells", async t => {
  const interpret = new Interpreter();
  const runtime = new Runtime();
  const main = runtime.module();
  let observer = () => null;

  const a = await interpret.cell(
    "viewof a = ({name: 'alex', value: 101, addEventListener: () => {} })",
    main,
    observer
  );

  t.equals(await main.value("a"), 101);
  t.equals((await main.value("viewof a")).name, "alex");
  t.equals(a.length, 2);
  t.equals(a[0]._name, "viewof a");
  t.equals(a[1]._name, "a");

  t.end();
});

test("Interpreter: mutable cells", async t => {
  const interpret = new Interpreter();
  const runtime = new Runtime();
  const main = runtime.module();
  let observer = () => null;

  const Mutable = await runtime._builtin.value("Mutable");

  let a = await interpret.cell("mutable a = 200", main, observer);

  t.equals(await main.value("initial a"), 200);
  t.equals((await main.value("mutable a")).constructor, Mutable);
  t.equals(await main.value("a"), 200);

  t.equals(a.length, 3);
  t.equals(a[0]._name, "initial a");
  t.equals(a[1]._name, "mutable a");
  t.equals(a[2]._name, "a");

  a = await interpret.cell("_ = (mutable a = 202)", main, observer);

  t.equals(a.length, 1);
  t.equals(a[0]._name, "_");
  t.equals(await main.value("_"), 202);
  t.equals(await main.value("a"), 202);

  t.end();
});

test("Interpreter: import cells", async t => {
  function resolveImportPath(name, specifiers) {
    const specs = new Set(specifiers);
    if (name === "alpha")
      return function define(runtime, observer) {
        const main = runtime.module();
        main.variable(observer("a")).define("a", function() {
          return 100;
        });
        main.variable(observer("b")).define("b", function() {
          return 200;
        });
        main.variable(observer("c")).define("c", ["a", "b"], function(a, b) {
          return a + b;
        });
        return main;
      };
    if (name === "delta")
      return function define(runtime, observer) {
        const main = runtime.module();
        main.variable(observer("d")).define("d", function() {
          return 1000;
        });
        main.variable(observer("e")).define("e", function() {
          return 2000;
        });
        main.variable(observer("f")).define("f", ["d", "e"], function(d, e) {
          return d - e;
        });
        return main;
      };
  }

  const interpret = new Interpreter({ resolveImportPath });
  let runtime = new Runtime();
  let main = runtime.module();
  let observer = () => null;

  const alpha = await interpret.cell(
    `import {a as A, b as B, c as C} from "alpha";`,
    main,
    observer
  );

  t.equals(alpha.length, 4);

  // the first is the unnamed "markdown" import cell
  t.equals(alpha[0]._name, null);
  t.equals(alpha[1]._name, "A");
  t.equals(alpha[2]._name, "B");
  t.equals(alpha[3]._name, "C");
  t.equals(await main.value("A"), 100);
  t.equals(await main.value("B"), 200);
  t.equals(await main.value("C"), 300);

  runtime.dispose();

  // fresh runtime/module for next stuff
  runtime = new Runtime();
  main = runtime.module();

  const program = await interpret.module(
    `
    import {c as C} from "alpha";

    import {f as F} with {C as d} from "delta";
  `,
    main,
    observer
  );

  t.equals(program.length, 2);
  t.equals(program[0].length, 2);
  t.equals(program[0][0]._name, null);
  t.equals(program[0][1]._name, "C");
  t.equals(program[1].length, 2);
  t.equals(program[1][0]._name, null);
  t.equals(program[1][1]._name, "F");
  // a=100, b=200, C = a + b
  t.equals(await main.value("C"), 300);
  // d=300 (C), e=2000, f=d-e
  t.equals(await main.value("F"), -1700);

  t.end();
});

test("Interpreter: resolveImportPath specifiers", async t => {
  function resolveImportPath(name, specifiers) {
    t.plan(1);
    return function define(runtime, observer) {
      t.deepEquals(specifiers, ["a", "b", "x"]);
      return main;
    };
  }
  const interpret = new Interpreter({ resolveImportPath });
  let runtime = new Runtime();
  let main = runtime.module();
  let observer = () => null;

  await interpret.cell(
    `import {a as A, b as B, x as X} from "alpha";`,
    main,
    observer
  );
  t.end();
});

test("Interpreter: defineImportMarkdown", async t => {
  function resolveImportPath(name) {
    return function define(runtime, observer) {
      const main = runtime.module();
      main.variable(observer("a")).define("a", function() {
        return 100;
      });
      return main;
    };
  }

  let interpret = new Interpreter({
    resolveImportPath,
    defineImportMarkdown: true
  });
  let runtime = new Runtime();
  let main = runtime.module();
  let observer = () => null;

  let a = await interpret.cell("import {a} from 'whatever';", main, observer);

  t.equals(a.length, 2);
  t.equals(a[0]._name, null);
  t.equals(a[0]._inputs[0]._name, "md");
  t.equals(a[1]._name, "a");

  runtime.dispose();

  interpret = new Interpreter({
    resolveImportPath,
    defineImportMarkdown: false
  });
  runtime = new Runtime();
  main = runtime.module();

  a = await interpret.cell("import {a} from 'whatever';", main, observer);

  t.equals(a.length, 1);
  t.equals(a[0]._name, "a");

  t.end();
});

test("Interpreter: observeViewofValues", async t => {
  let aObserved = false;
  let bObserved = false;

  let interpret = new Interpreter({
    observeViewofValues: true
  });
  let runtime = new Runtime();
  let main = runtime.module();

  function observerA(name) {
    if (name === "a") aObserved = true;
  }

  await interpret.cell(
    "viewof a = ({value: 100, addEventListener: () => {}, removeEventListener: () => {}})",
    main,
    observerA
  );

  t.true(aObserved);
  t.equals(await main.value("a"), 100);
  runtime.dispose();

  interpret = new Interpreter({
    observeViewofValues: false
  });
  runtime = new Runtime();
  main = runtime.module();

  function observerB(name) {
    if (name === "b") bObserved = true;
  }

  await interpret.cell(
    "viewof b = ({value: 200, addEventListener: () => {}})",
    main,
    observerB
  );

  t.false(bObserved);
  t.equals(await main.value("b"), 200);

  t.end();
});

test("Interpreter: observeMutableValues", async t => {
  let aObserved = false;
  let bObserved = false;

  let interpret = new Interpreter({
    observeMutableValues: true
  });
  let runtime = new Runtime();
  let main = runtime.module();

  function observerA(name) {
    if (name === "a") aObserved = true;
  }

  await interpret.cell("mutable a = 0x100", main, observerA);

  t.true(aObserved);
  t.equals(await main.value("a"), 0x100);
  runtime.dispose();

  interpret = new Interpreter({
    observeMutableValues: false
  });
  runtime = new Runtime();
  main = runtime.module();

  function observerB(name) {
    if (name === "b") bObserved = true;
  }

  await interpret.cell("mutable b = 0x200", main, observerB);

  t.false(bObserved);
  t.equals(await main.value("b"), 0x200);

  t.end();
});

// TODO: resolveFileAttachments test.
