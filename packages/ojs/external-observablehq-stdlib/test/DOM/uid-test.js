import assert from "assert";
import {uid} from "../../src/dom/uid.js";

it("uid", () => {
  global.location = "https://test.com/";
  const hi = uid("hi");
  assert.deepEqual(hi, {id: "O-hi-1", href: "https://test.com/#O-hi-1"});
  assert.strictEqual(hi.toString(), "url(https://test.com/#O-hi-1)");
  const anon = uid();
  assert.strictEqual(anon.toString(), "url(https://test.com/#O-2)");
});
