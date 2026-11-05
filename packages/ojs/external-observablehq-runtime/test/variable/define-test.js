import {Runtime} from "@observablehq/runtime";
import assert from "assert";
import {valueof} from "./valueof.js";

it("variable.define(name, inputs, definition) can define a variable", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define("foo", [], () => 42);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define(inputs, function) can define an anonymous variable", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define([], () => 42);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define(name, function) can define a named variable", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define("foo", () => 42);
  const bar = module.variable(true).define("bar", ["foo"], foo => foo);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
  assert.deepStrictEqual(await valueof(bar), {value: 42});
});

it("variable.define(function) can define an anonymous variable", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define(() => 42);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define(null, inputs, value) can define an anonymous constant", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define(null, [], 42);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define(inputs, value) can define an anonymous constant", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define([], 42);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define(null, value) can define an anonymous constant", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define(null, 42);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define(value) can define an anonymous constant", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define(42);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define detects missing inputs", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true);
  const bar = module.variable(true).define("bar", ["foo"], foo => foo);
  assert.deepStrictEqual(await valueof(foo), {value: undefined});
  assert.deepStrictEqual(await valueof(bar), {error: "RuntimeError: foo is not defined"});
  foo.define("foo", 1);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(bar), {value: 1});
});

it("variable.define detects duplicate names", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define("foo", 1);
  const bar = module.variable(true).define("foo", 2);
  assert.deepStrictEqual(await valueof(foo), {error: "RuntimeError: foo is defined more than once"});
  assert.deepStrictEqual(await valueof(bar), {error: "RuntimeError: foo is defined more than once"});
  bar.define("bar", 2);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(bar), {value: 2});
});

it("variable.define recomputes reachability as expected", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const module = runtime.module();
  const quux = module.define("quux", [], () => 42);
  const baz = module.define("baz", ["quux"], quux => `baz-${quux}`);
  const bar = module.define("bar", ["quux"], quux => `bar-${quux}`);
  const foo = main.variable(true).define("foo", ["bar", "baz", "quux"], (bar, baz, quux) => [bar, baz, quux]);
  main.variable().import("bar", module);
  main.variable().import("baz", module);
  main.variable().import("quux", module);
  await runtime._compute();
  assert.strictEqual(quux._reachable, true);
  assert.strictEqual(baz._reachable, true);
  assert.strictEqual(bar._reachable, true);
  assert.strictEqual(foo._reachable, true);
  assert.deepStrictEqual(await valueof(foo), {value: ["bar-42", "baz-42", 42]});
  foo.define("foo", [], () => "foo");
  await runtime._compute();
  assert.strictEqual(quux._reachable, false);
  assert.strictEqual(baz._reachable, false);
  assert.strictEqual(bar._reachable, false);
  assert.strictEqual(foo._reachable, true);
  assert.deepStrictEqual(await valueof(foo), {value: "foo"});
});

it("variable.define correctly detects reachability for unreachable cycles", async () => {
  let returned = false;
  const runtime = new Runtime();
  const main = runtime.module();
  const module = runtime.module();
  const bar = module.define("bar", ["baz"], baz => `bar-${baz}`);
  const baz = module.define("baz", ["quux"], quux => `baz-${quux}`);
  const quux = module.define("quux", ["zapp"], function*(zapp) { try { while (true) yield `quux-${zapp}`; } finally { returned = true; }});
  const zapp = module.define("zapp", ["bar"], bar => `zaap-${bar}`);
  await runtime._compute();
  assert.strictEqual(bar._reachable, false);
  assert.strictEqual(baz._reachable, false);
  assert.strictEqual(quux._reachable, false);
  assert.strictEqual(zapp._reachable, false);
  assert.deepStrictEqual(await valueof(bar), {value: undefined});
  assert.deepStrictEqual(await valueof(baz), {value: undefined});
  assert.deepStrictEqual(await valueof(quux), {value: undefined});
  assert.deepStrictEqual(await valueof(zapp), {value: undefined});
  main.variable().import("bar", module);
  const foo = main.variable(true).define("foo", ["bar"], bar => bar);
  await runtime._compute();
  assert.strictEqual(foo._reachable, true);
  assert.strictEqual(bar._reachable, true);
  assert.strictEqual(baz._reachable, true);
  assert.strictEqual(quux._reachable, true);
  assert.strictEqual(zapp._reachable, true);
  assert.deepStrictEqual(await valueof(bar), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(baz), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(quux), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(zapp), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(foo), {error: "RuntimeError: circular definition"});
  foo.define("foo", [], () => "foo");
  await runtime._compute();
  assert.strictEqual(foo._reachable, true);
  assert.strictEqual(bar._reachable, false);
  assert.strictEqual(baz._reachable, false);
  assert.strictEqual(quux._reachable, false);
  assert.strictEqual(zapp._reachable, false);
  assert.deepStrictEqual(await valueof(bar), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(baz), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(quux), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(zapp), {error: "RuntimeError: circular definition"});
  assert.deepStrictEqual(await valueof(foo), {value: "foo"});
  assert.strictEqual(returned, false); // Generator is never finalized because it has never run.
});

it("variable.define terminates previously reachable generators", async () => {
  let returned = false;
  const runtime = new Runtime();
  const main = runtime.module();
  const module = runtime.module();
  const bar = module.define("bar", [], function*() { try { while (true) yield 1; } finally { returned = true; }});
  const foo = main.variable(true).define("foo", ["bar"], bar => bar);
  main.variable().import("bar", module);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  foo.define("foo", [], () => "foo");
  assert.deepStrictEqual(await valueof(foo), {value: "foo"});
  assert.strictEqual(bar._generator, undefined);
  assert.strictEqual(returned, true);
});

it("variable.define does not terminate reachable generators", async () => {
  let returned = false;
  const runtime = new Runtime();
  const main = runtime.module();
  const module = runtime.module();
  const bar = module.define("bar", [], function*() { try { while (true) yield 1; } finally { returned = true; }});
  const baz = main.variable(true).define("baz", ["bar"], bar => bar);
  const foo = main.variable(true).define("foo", ["bar"], bar => bar);
  main.variable().import("bar", module);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(baz), {value: 1});
  foo.define("foo", [], () => "foo");
  assert.deepStrictEqual(await valueof(foo), {value: "foo"});
  assert.deepStrictEqual(await valueof(baz), {value: 1});
  assert.strictEqual(returned, false);
  bar._invalidate();
  await runtime._compute();
  assert.strictEqual(returned, true);
});

it("variable.define detects duplicate declarations", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const v1 = main.variable(true).define("foo", [], () => 1);
  const v2 = main.variable(true).define("foo", [], () => 2);
  const v3 = main.variable(true).define(null, ["foo"], foo => foo);
  assert.deepStrictEqual(await valueof(v1), {error: "RuntimeError: foo is defined more than once"});
  assert.deepStrictEqual(await valueof(v2), {error: "RuntimeError: foo is defined more than once"});
  assert.deepStrictEqual(await valueof(v3), {error: "RuntimeError: foo is defined more than once"});
});

it("variable.define detects missing inputs and erroneous inputs", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const v1 = main.variable(true).define("foo", ["baz"], () => 1);
  const v2 = main.variable(true).define("bar", ["foo"], () => 2);
  assert.deepStrictEqual(await valueof(v1), {error: "RuntimeError: baz is not defined"});
  assert.deepStrictEqual(await valueof(v2), {error: "RuntimeError: baz is not defined"});
});

it("variable.define allows masking of builtins", async () => {
  const runtime = new Runtime({color: "red"});
  const main = runtime.module();
  const mask = main.define("color", "green");
  const foo = main.variable(true).define(null, ["color"], color => color);
  assert.deepStrictEqual(await valueof(foo), {value: "green"});
  mask.delete();
  assert.deepStrictEqual(await valueof(foo), {value: "red"});
});

it("variable.define supports promises", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], () => new Promise(resolve => setImmediate(() => resolve(42))));
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define supports generator cells", async () => {
  let i = 0;
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], function*() { while (i < 3) yield ++i; });
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(foo), {value: 2});
  assert.deepStrictEqual(await valueof(foo), {value: 3});
});

it("variable.define supports generator objects", async () => {
  function* range(n) { for (let i = 0; i < n; ++i) yield i; }
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], () => range(3));
  assert.deepStrictEqual(await valueof(foo), {value: 0});
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(foo), {value: 2});
});

it("variable.define supports a promise that resolves to a generator object", async () => {
  function* range(n) { for (let i = 0; i < n; ++i) yield i; }
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], async () => range(3));
  assert.deepStrictEqual(await valueof(foo), {value: 0});
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(foo), {value: 2});
});

it("variable.define supports generators that yield promises", async () => {
  let i = 0;
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], function*() { while (i < 3) yield Promise.resolve(++i); });
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(foo), {value: 2});
  assert.deepStrictEqual(await valueof(foo), {value: 3});
});

it("variable.define allows a variable to be redefined", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], () => 1);
  const bar = main.variable(true).define("bar", ["foo"], foo => new Promise(resolve => setImmediate(() => resolve(foo))));
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(bar), {value: 1});
  foo.define("foo", [], () => 2);
  assert.deepStrictEqual(await valueof(foo), {value: 2});
  assert.deepStrictEqual(await valueof(bar), {value: 2});
});

it("variable.define recomputes downstream values when a variable is renamed", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], () => 1);
  const bar = main.variable(true).define("bar", [], () => 2);
  const baz = main.variable(true).define("baz", ["foo", "bar"], (foo, bar) => foo + bar);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(bar), {value: 2});
  assert.deepStrictEqual(await valueof(baz), {value: 3});
  foo.define("quux", [], () => 10);
  assert.deepStrictEqual(await valueof(foo), {value: 10});
  assert.deepStrictEqual(await valueof(bar), {value: 2});
  assert.deepStrictEqual(await valueof(baz), {error: "RuntimeError: foo is not defined"});
});

it("variable.define ignores an asynchronous result from a redefined variable", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const foo = main.variable(true).define("foo", [], () => new Promise(resolve => setTimeout(() => resolve("fail"), 150)));
  await new Promise(setImmediate);
  foo.define("foo", [], () => "success");
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepStrictEqual(await valueof(foo), {value: "success"});
  assert.deepStrictEqual(foo._value, "success");
});

it("variable.define ignores an asynchronous result from a redefined input", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  const bar = main.variable().define("bar", [], () => new Promise(resolve => setTimeout(() => resolve("fail"), 150)));
  const foo = main.variable(true).define("foo", ["bar"], bar => bar);
  await new Promise(setImmediate);
  bar.define("bar", [], () => "success");
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepStrictEqual(await valueof(foo), {value: "success"});
  assert.deepStrictEqual(foo._value, "success");
});

it("variable.define does not try to compute unreachable variables", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  let evaluated = false;
  const foo = main.variable(true).define("foo", [], () => 1);
  const bar = main.variable().define("bar", ["foo"], (foo) => evaluated = foo);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(bar), {value: undefined});
  assert.strictEqual(evaluated, false);
});

it("variable.define does not try to compute unreachable variables that are outputs of reachable variables", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  let evaluated = false;
  const foo = main.variable(true).define("foo", [], () => 1);
  const bar = main.variable(true).define("bar", [], () => 2);
  const baz = main.variable().define("baz", ["foo", "bar"], (foo, bar) => evaluated = foo + bar);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(bar), {value: 2});
  assert.deepStrictEqual(await valueof(baz), {value: undefined});
  assert.strictEqual(evaluated, false);
});

it("variable.define can reference whitelisted globals", async () => {
  const runtime = new Runtime(null, name => name === "magic" ? 21 : undefined);
  const module = runtime.module();
  const foo = module.variable(true).define(["magic"], magic => magic * 2);
  assert.deepStrictEqual(await valueof(foo), {value: 42});
});

it("variable.define captures the value of whitelisted globals", async () => {
  let magic = 0;
  const runtime = new Runtime(null, name => name === "magic" ? ++magic : undefined);
  const module = runtime.module();
  const foo = module.variable(true).define(["magic"], magic => magic * 2);
  assert.deepStrictEqual(await valueof(foo), {value: 2});
  assert.deepStrictEqual(await valueof(foo), {value: 2});
});

it("variable.define can override whitelisted globals", async () => {
  const runtime = new Runtime(null, name => name === "magic" ? 1 : undefined);
  const module = runtime.module();
  module.variable().define("magic", [], () => 2);
  const foo = module.variable(true).define(["magic"], magic => magic * 2);
  assert.deepStrictEqual(await valueof(foo), {value: 4});
});

it("variable.define can dynamically override whitelisted globals", async () => {
  const runtime = new Runtime(null, name => name === "magic" ? 1 : undefined);
  const module = runtime.module();
  const foo = module.variable(true).define(["magic"], magic => magic * 2);
  assert.deepStrictEqual(await valueof(foo), {value: 2});
  module.variable().define("magic", [], () => 2);
  assert.deepStrictEqual(await valueof(foo), {value: 4});
});

it("variable.define cannot reference non-whitelisted globals", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define(["magic"], magic => magic * 2);
  assert.deepStrictEqual(await valueof(foo), {error: "RuntimeError: magic is not defined"});
});

it("variable.define correctly handles globals that throw", async () => {
  const runtime = new Runtime(null, name => { if (name === "oops") throw new Error("oops"); });
  const module = runtime.module();
  const foo = module.variable(true).define(["oops"], oops => oops);
  assert.deepStrictEqual(await valueof(foo), {error: "RuntimeError: oops"});
});

it("variable.define allows other variables to begin computation before a generator may resume", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const main = runtime.module();
  let i = 0;
  let genIteration = 0;
  let valIteration = 0;
  const onGenFulfilled = value => {
    if (genIteration === 0) {
      assert.strictEqual(valIteration, 0);
      assert.strictEqual(value, 1);
      assert.strictEqual(i, 1);
    } else if (genIteration === 1) {
      assert.strictEqual(valIteration, 1);
      assert.strictEqual(value, 2);
      assert.strictEqual(i, 2);
    } else if (genIteration === 2) {
      assert.strictEqual(valIteration, 2);
      assert.strictEqual(value, 3);
      assert.strictEqual(i, 3);
    } else {
      assert.fail();
    }
    genIteration++;
  };
  const onValFulfilled = value => {
    if (valIteration === 0) {
      assert.strictEqual(genIteration, 1);
      assert.strictEqual(value, 1);
      assert.strictEqual(i, 1);
    } else if (valIteration === 1) {
      assert.strictEqual(genIteration, 2);
      assert.strictEqual(value, 2);
      assert.strictEqual(i, 2);
    } else if (valIteration === 2) {
      assert.strictEqual(genIteration, 3);
      assert.strictEqual(value, 3);
      assert.strictEqual(i, 3);
    } else {
      assert.fail();
    }
    valIteration++;
  };
  const gen = module.variable({fulfilled: onGenFulfilled}).define("gen", [], function*() {
    i++;
    yield i;
    i++;
    yield i;
    i++;
    yield i;
  });
  main.variable().import("gen", module);
  const val = main.variable({fulfilled: onValFulfilled}).define("val", ["gen"], i => i);
  assert.strictEqual(await gen._promise, undefined, "gen cell undefined");
  assert.strictEqual(await val._promise, undefined, "val cell undefined");
  await runtime._compute();
  assert.strictEqual(await gen._promise, 1, "gen cell 1");
  assert.strictEqual(await val._promise, 1, "val cell 1");
  await runtime._compute();
  assert.strictEqual(await gen._promise, 2, "gen cell 2");
  assert.strictEqual(await val._promise, 2, "val cell 2");
  await runtime._compute();
  assert.strictEqual(await gen._promise, 3, "gen cell 3");
  assert.strictEqual(await val._promise, 3, "val cell 3");
});

it("variable.define allows other variables to begin computation before a generator may resume", async () => {
  const runtime = new Runtime();
  const main = runtime.module();
  let i = 0;
  let j = 0;
  const gen = main.variable().define("gen", [], function*() {
    i++;
    yield i;
    i++;
    yield i;
    i++;
    yield i;
  });
  const val = main.variable(true).define("val", ["gen"], gen => {
    j++;
    assert.strictEqual(gen, j, "gen = j");
    assert.strictEqual(gen, i, "gen = i");
    return gen;
  });
  assert.strictEqual(await gen._promise, undefined, "gen = undefined");
  assert.strictEqual(await val._promise, undefined, "val = undefined");
  await runtime._compute();
  assert.strictEqual(await gen._promise, 1, "gen cell 1");
  assert.strictEqual(await val._promise, 1, "val cell 1");
  await runtime._compute();
  assert.strictEqual(await gen._promise, 2, "gen cell 2");
  assert.strictEqual(await val._promise, 2, "val cell 2");
  await runtime._compute();
  assert.strictEqual(await gen._promise, 3, "gen cell 3");
  assert.strictEqual(await val._promise, 3, "val cell 3");
});

it("variable.define does not report stale fulfillments", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const values = [];
  const errors = [];
  const variable = module.variable({
    fulfilled(value) {
      values.push(value);
    },
    rejected(error) {
      errors.push(error);
    }
  });
  const promise = new Promise((resolve) => setTimeout(() => resolve("value1"), 250));
  variable.define(() => promise);
  await runtime._computing;
  variable.define(() => "value2");
  await promise;
  assert.deepStrictEqual(await valueof(variable), {value: "value2"});
  assert.deepStrictEqual(values, ["value2"]);
  assert.deepStrictEqual(errors, []);
});

it("variable.define does not report stale rejections", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const values = [];
  const errors = [];
  const variable = module.variable({
    fulfilled(value) {
      values.push(value);
    },
    rejected(error) {
      errors.push(error);
    }
  });
  const promise = new Promise((resolve, reject) => setTimeout(() => reject("error1"), 250));
  variable.define(() => promise);
  await runtime._computing;
  variable.define(() => Promise.reject("error2"));
  await promise.catch(() => {});
  assert.deepStrictEqual(await valueof(variable), {error: "error2"});
  assert.deepStrictEqual(values, []);
  assert.deepStrictEqual(errors, ["error2"]);
});
