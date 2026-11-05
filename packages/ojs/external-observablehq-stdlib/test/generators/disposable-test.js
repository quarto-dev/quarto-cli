import assert from "assert";
import {disposable} from "../../src/generators/disposable.js";

it("disposable(value, dispose) yields the specified value", async () => {
  const foo = {};
  const generator = disposable(foo, () => {});
  assert.deepStrictEqual(generator.next(), {done: false, value: foo});
  assert.deepStrictEqual(generator.next(), {done: true});
});

it("disposable(value, dispose) defines generator.return", async () => {
  let passedFoo;
  const foo = {};
  const generator = disposable(foo, _ => (passedFoo = _));
  assert.deepStrictEqual(generator.return(), {done: true});
  assert.strictEqual(passedFoo, foo);
  assert.deepStrictEqual(generator.next(), {done: true});
});

it("disposable(value, dispose) defines generator.throw", async () => {
  const generator = disposable(42, () => {});
  assert.deepStrictEqual(generator.throw(new Error()), {done: true});
  assert.deepStrictEqual(generator.next(), {done: true});
});
