/*
 * image-size.test.ts
 *
 * imageSize (src/core/image.ts) reads the pixel size of an image file from
 * its header bytes, whatever the file extension.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { imageSize } from "../../../src/core/image.ts";
import { docs, withTempDir } from "../../utils.ts";

// deno-lint-ignore require-await
unitTest("imageSize - baseline JPEG", async () => {
  assertEquals(
    imageSize(docs("reveal/mini/images/kitten-300-450.jpeg")),
    { height: 450, width: 300 },
  );
});

// deno-lint-ignore require-await
unitTest("imageSize - progressive JPEG", async () => {
  assertEquals(
    imageSize(docs("blog/posts/welcome/thumbnail.jpg")),
    { height: 427, width: 640 },
  );
});

unitTest("imageSize - PNG with an uppercase extension", async () => {
  await withTempDir((dir) => {
    const png = join(dir, "feed.PNG");
    Deno.copyFileSync(docs("listings-feed-image/feed.png"), png);
    assertEquals(imageSize(png), { height: 400, width: 600 });
  });
});

// deno-lint-ignore require-await
unitTest("imageSize - SVG has no size", async () => {
  assertEquals(
    imageSize(docs("smoke-all/2024/01/26/simple-svg.svg")),
    undefined,
  );
});

// deno-lint-ignore require-await
unitTest("imageSize - unknown format has no size", async () => {
  assertEquals(imageSize(docs("listings-feed-image/index.qmd")), undefined);
});
