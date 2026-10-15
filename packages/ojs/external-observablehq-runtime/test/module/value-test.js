import {Runtime} from "@observablehq/runtime";
import assert from "assert";

it("module.value(name) returns a promise to the variable’s next value", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.variable(true).define("foo", [], () => 42);
  assert.deepStrictEqual(await module.value("foo"), 42);
});

it("module.value(name) implicitly makes the variable reachable", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], () => 42);
  assert.deepStrictEqual(await module.value("foo"), 42);
});

it("module.value(name) supports errors", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], () => { throw new Error(42); });
  await assert.rejects(() => module.value("foo"), /42/);
});

it("module.value(name) supports generators", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], function*() { yield 1; yield 2; yield 3; });
  assert.deepStrictEqual(await module.value("foo"), 1);
  assert.deepStrictEqual(await module.value("foo"), 2);
  assert.deepStrictEqual(await module.value("foo"), 3);
  assert.deepStrictEqual(await module.value("foo"), 3);
});

it("module.value(name) supports generators that throw", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], function*() { yield 1; throw new Error("fooed"); });
  module.define("bar", ["foo"], foo => foo);
  const [foo1, bar1] = await Promise.all([module.value("foo"), module.value("bar")]);
  assert.deepStrictEqual(foo1, 1);
  assert.deepStrictEqual(bar1, 1);
  await assert.rejects(() => module.value("foo"), /fooed/);
  await assert.rejects(() => module.value("bar"), /fooed/);
});

it("module.value(name) supports async generators", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], async function*() { yield 1; yield 2; yield 3; });
  assert.deepStrictEqual(await module.value("foo"), 1);
  assert.deepStrictEqual(await module.value("foo"), 2);
  assert.deepStrictEqual(await module.value("foo"), 3);
  assert.deepStrictEqual(await module.value("foo"), 3);
});

it("module.value(name) supports promises", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], async () => { return await 42; });
  assert.deepStrictEqual(await module.value("foo"), 42);
});

it("module.value(name) supports constants", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], 42);
  assert.deepStrictEqual(await module.value("foo"), 42);
});

it("module.value(name) supports missing variables", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  await assert.rejects(() => module.value("bar"), /bar is not defined/);
});

it("module.value(name) returns a promise on error", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const promise = module.value("bar");
  await assert.rejects(promise, /bar is not defined/);
});

it("module.value(name) does not force recomputation", async () => {
  let foo = 0;
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], () => ++foo);
  assert.deepStrictEqual(await module.value("foo"), 1);
  assert.deepStrictEqual(await module.value("foo"), 1);
  assert.deepStrictEqual(await module.value("foo"), 1);
});

it("module.value(name) does not expose stale values", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  let resolve;
  const variable = module.define("foo", [], new Promise((y) => (resolve = y)));
  const value = module.value("foo");
  await new Promise((resolve) => setTimeout(resolve, 100));
  variable.define("foo", [], () => "fresh");
  resolve("stale");
  assert.strictEqual(await value, "fresh");
});

it("module.value(name) does not continue observing", async () => {
  const foos = [];
  const runtime = new Runtime();
  const module = runtime.module();
  module.define("foo", [], async function*() {
    try {
      foos.push(1), yield 1;
      foos.push(2), yield 2;
      foos.push(3), yield 3;
    } finally {
      foos.push(-1);
    }
  });
  assert.strictEqual(await module.value("foo"), 1);
  assert.deepStrictEqual(foos, [1]);
  await runtime._compute();
  assert.deepStrictEqual(foos, [1, 2, -1]); // 2 computed prior to being unobserved
  await runtime._compute();
  assert.deepStrictEqual(foos, [1, 2, -1]); // any change would represent a leak
});
