/*
* binary-search.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { glb } from "../../src/core/lib/binary-search.ts";
import bounds from "binary-search-bounds";

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";

// deno-lint-ignore require-await
unitTest("binary-search-test - glb property tests", async () => {
  // test by randomization that glb() behaves like le()

  const nTests = 1000;
  // const nTests = 10000000; // this passed locally
  for (let i = 0; i < nTests; ++i) {
    const sz = ~~(Math.random() * 10);
    const a: number[] = [];
    for (let j = 0; j < sz; ++j) {
      a.push(~~(Math.random() * 10));
    }
    a.sort();
    const n = ~~(Math.random() * 10);
    const ours = glb(a, n);
    const theirs = bounds.le(a, n);
    if (ours !== theirs) {
      console.log("randomization failed!", { a, n });
    }
    assert(ours === theirs);
  }
});

// deno-lint-ignore require-await
unitTest("binary-search-test - previous failures", async () => {
  assert(glb([1, 2, 4, 5, 5, 6, 6, 7, 7], 9) === 8);
  assert(glb([5, 8, 9], 1) === -1);
  assert(glb([5], 4) === -1);
  assert(glb([5], 5) === 0);
  assert(glb([5], 6) === 0);
});
