import assert from "assert";
import {filter} from "../../src/generators/filter.js";
import {map} from "../../src/generators/map.js";
import {range} from "../../src/generators/range.js";
import {valueAt} from "../../src/generators/valueAt.js";
import {observe} from "../../src/generators/observe.js";
import {queue} from "../../src/generators/queue.js";
import {Library} from "../../src/library.js";

it("library.Generators.observe is a function", () => {
  const library = new Library();
  assert.strictEqual(typeof library.Generators.observe, "function");
});

it("filter(value, fn) filters", () => {
  function* input() {
    yield* [1, 2, 3, 4];
  }
  assert.deepStrictEqual(Array.from(filter(input(), i => i % 2 === 0)), [2, 4]);
});

it("map(value, fn) maps", () => {
  function* input() {
    yield* [1, 2, 3, 4];
  }
  assert.deepStrictEqual(Array.from(map(input(), i => i * 2)), [2, 4, 6, 8]);
});

it("range(start, stop) generates a range", () => {
  assert.deepStrictEqual(Array.from(range(1, 4)), [1, 2, 3]);
  assert.deepStrictEqual(Array.from(range(1, 5, 2)), [1, 3]);
  assert.deepStrictEqual(Array.from(range(3)), [0, 1, 2]);
});

it("valueAt(generator, i) picks a value", () => {
  function* input() {
    yield* [1, 2, 3, 4];
  }
  assert.strictEqual(valueAt(input(), 2), 3);
  assert.strictEqual(valueAt(input()), undefined);
});

it("observe only yields the most recent value", async () => {
  let o = observe(change => {
    change(1);
    change(2);
  });
  assert.strictEqual(await o.next().value, 2);
});

it("queue yields all values", async () => {
  let q = queue(change => {
    change(1);
    change(2);
  });
  assert.strictEqual(await q.next().value, 1);
  assert.strictEqual(await q.next().value, 2);
});
