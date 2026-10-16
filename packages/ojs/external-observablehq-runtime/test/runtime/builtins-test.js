import {Runtime} from "@observablehq/runtime";
import assert from "assert";
import {valueof} from "../variable/valueof.js";

it("new Runtime(builtins) allows builtins to be defined as promises", async () => {
  const runtime = new Runtime({color: Promise.resolve("red")});
  const main = runtime.module();
  const foo = main.variable(true).define(null, ["color"], color => color);
  assert.deepStrictEqual(await valueof(foo), {value: "red"});
});

it("new Runtime(builtins) allows builtins to be defined as functions", async () => {
  const runtime = new Runtime({color: () => "red"});
  const main = runtime.module();
  const foo = main.variable(true).define(null, ["color"], color => color);
  assert.deepStrictEqual(await valueof(foo), {value: "red"});
});

it("new Runtime(builtins) allows builtins to be defined as async functions", async () => {
  const runtime = new Runtime({color: async () => "red"});
  const main = runtime.module();
  const foo = main.variable(true).define(null, ["color"], color => color);
  assert.deepStrictEqual(await valueof(foo), {value: "red"});
});

it("new Runtime(builtins) allows builtins to be defined as generators", async () => {
  let i = 0;
  const runtime = new Runtime({i: function*() { while (i < 3) yield ++i; }});
  const main = runtime.module();
  const foo = main.variable(true).define(null, ["i"], i => i);
  assert.deepStrictEqual(await valueof(foo), {value: 1});
  assert.deepStrictEqual(await valueof(foo), {value: 2});
  assert.deepStrictEqual(await valueof(foo), {value: 3});
});
