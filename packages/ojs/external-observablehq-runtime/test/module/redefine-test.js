import {Runtime} from "@observablehq/runtime";
import assert from "assert";
import {valueof} from "../variable/valueof.js";

it("module.redefine(name, inputs, definition) can redefine a normal variable", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define("foo", [], () => 42);
  assert.strictEqual(module.redefine("foo", [], () => 43), foo);
  assert.deepStrictEqual(await valueof(foo), {value: 43});
});

it("module.redefine(name, inputs, definition) can redefine an implicit variable", async () => {
  const runtime = new Runtime({foo: 42});
  const module = runtime.module();
  const bar = module.variable(true).define("bar", ["foo"], foo => foo + 1);
  module.redefine("foo", [], () => 43);
  assert.deepStrictEqual(await valueof(bar), {value: 44});
});

it("module.redefine(name, inputs, definition) can’t redefine a duplicate definition", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo1 = module.variable(true).define("foo", [], () => 1);
  const foo2 = module.variable(true).define("foo", [], () => 2);
  assert.throws(() => module.redefine("foo", [], () => 3), /foo is defined more than once/);
  assert.deepStrictEqual(await valueof(foo1), {error: "RuntimeError: foo is defined more than once"});
  assert.deepStrictEqual(await valueof(foo2), {error: "RuntimeError: foo is defined more than once"});
});

it("module.redefine(name, inputs, definition) throws an error if the specified variable doesn’t exist", async () => {
  const runtime = new Runtime();
  const module = runtime.module();
  const foo = module.variable(true).define("foo", [], () => 42);
  assert.throws(() => module.redefine("bar", [], () => 43, foo), /bar is not defined/);
});
