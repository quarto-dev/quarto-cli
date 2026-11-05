import assert from "assert";
import {peekId} from "@observablehq/parser";

it("peekId", () => {
  assert.strictEqual(peekId("a = 1"), "a");
  assert.strictEqual(peekId("viewof a = 1"), "a");
  assert.strictEqual(peekId("mutable a = 1"), "a");
  assert.strictEqual(peekId("mutable async = 1"), "async");
  assert.strictEqual(peekId("class A {"), "A");
  assert.strictEqual(peekId("class Z"), undefined);
  assert.strictEqual(peekId("class Z "), "Z");
  assert.strictEqual(peekId("function a"), undefined);
  assert.strictEqual(peekId("function a()"), "a");
  assert.strictEqual(peekId("async function a()"), "a");
  assert.strictEqual(peekId("async function* a()"), "a");
  assert.strictEqual(peekId("function* a"), undefined);
  assert.strictEqual(peekId("function /* yeah */ a()"), "a");
  assert.strictEqual(peekId("function"), undefined);
  assert.strictEqual(peekId("1"), undefined);
  assert.strictEqual(peekId("#"), undefined, "Ignores syntax errors");
  assert.strictEqual(peekId("abc /"), undefined, "Needs a = for a name to be identified");
  assert.strictEqual(peekId("({ a: 1 })"), undefined);
  assert.strictEqual(
    peekId(`function queryAll(text, values) {
  return fetch("https://api.observable.localh`),
    "queryAll"
  );
});
