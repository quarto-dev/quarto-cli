/*
* lines.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";
import { lines, mappedString } from "../../src/core/text.ts";

unitTest("text - lines()", () => {
  const texts = ["a", "b", "c"];
  const splits = ["\n", "\r\n"];
  splits.forEach((split) => {
    assert(
      lines(texts.join(split)).length === texts.length,
      "Invalid line count",
    );
  });
});

unitTest("text - mappedString()", () => {
  const source = `---
title: foo
echo: false
---
Here's some text.

\`\`\`{python}
#| echo: true
#| code-fold: true
# and some python
import time
print(time.time())
\`\`\`

`;

  const yamlFrontMatterRangedS = mappedString(source, [
    { start: 4, end: 27 }]);
  const pythonChunkS = mappedString(source, [
    { start: 62, end: 144 }]);

  // this tests composition of ranged strings
  const chunkMetadataS = mappedString(pythonChunkS, [
    { start: 3, end: 14 },
    { start: 17, end: 33 }
  ]);
  
  assert(yamlFrontMatterRangedS.map(0) === 4, "range map");
  assert(yamlFrontMatterRangedS.map(22) === 26, "range map");
  assert(yamlFrontMatterRangedS.map(-1) === undefined, "range map");
  assert(yamlFrontMatterRangedS.map(23) === undefined, "range map");

  assert(pythonChunkS.map(0) === 62, "range map");
  assert(pythonChunkS.map(144-62-1) === 143, "range map");
  assert(pythonChunkS.map(144-62) === undefined, "range map");

  assert(chunkMetadataS.map(0) === 65, "composed range map");
  assert(chunkMetadataS.map(14-3-1) === 75, "composed range map");
  assert(chunkMetadataS.map(14-3) === 79, "composed range map");
  assert(chunkMetadataS.map(14-3+(33-17-1)) === 94, "composed range map");
  assert(chunkMetadataS.map(14-3+(33-17)) === undefined, "composed range map");
});
