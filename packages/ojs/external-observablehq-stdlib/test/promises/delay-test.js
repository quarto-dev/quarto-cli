import assert from "assert";
import {delay} from "../../src/promises/delay.js";
import {tick} from "../../src/promises/tick.js";

it("delay(duration) resolves with undefined", async () => {
  assert.strictEqual(await delay(50), undefined);
});

it("delay(duration) resolves after the specified duration", async () => {
  const then = Date.now();
  await delay(150);
  const delta = Date.now() - then;
  assert.ok(130 <= delta && delta <= 170);
});

it("delay(duration, value) resolves with the specified value", async () => {
  assert.strictEqual(await delay(50, "foo"), "foo");
});

it("delay(duration, value) resolves with the specified value after the specified duration", async () => {
  const then = Date.now();
  assert.strictEqual(await delay(150, "foo"), "foo");
  const delta = Date.now() - then;
  assert.ok(130 <= delta && delta <= 170);
});

it("tick(1000) resolves near the second boundary", async () => {
  await tick(1000);
  const now = Date.now();
  assert.ok(now % 1000 < 10, `${now % 1000} deviation from the second`);
});
