/*
 * css-references.test.ts
 *
 * fixupCssReferences puts the offset in front of root-relative references,
 * so an offset without a trailing slash must still give a valid path.
 * See https://github.com/quarto-dev/quarto-cli/issues/15362
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";
import { fixupCssReferences } from "../../../src/project/project-resources.ts";

const css = '@import "/a/base.css";\nbody { background: url(/a/bg.png); }';
const keep = (ref: string) => ref;

// deno-lint-ignore require-await
unitTest(
  "fixupCssReferences - offset without a trailing slash",
  async () => {
    assertEquals(
      fixupCssReferences(css, "../..", keep),
      '@import "../../a/base.css";\nbody { background: url(../../a/bg.png); }',
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fixupCssReferences - offset with a trailing slash is not doubled",
  async () => {
    assertEquals(
      fixupCssReferences(css, "../", keep),
      '@import "../a/base.css";\nbody { background: url(../a/bg.png); }',
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fixupCssReferences - empty offset for a stylesheet at the root",
  async () => {
    assertEquals(
      fixupCssReferences(css, "", keep),
      '@import "a/base.css";\nbody { background: url(a/bg.png); }',
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fixupCssReferences - relative references stay unchanged",
  async () => {
    const relative = 'body { background: url("img/bg.png"); }';
    assertEquals(fixupCssReferences(relative, "..", keep), relative);
  },
);
