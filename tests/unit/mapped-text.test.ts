/*
* mapped-text.test.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";
import { mappedString } from "../../src/core/mapped-text.ts";

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

  function allMatch(a: any[], b: any[]) {
    return a.every((v, i) => v === b[i]);
  }
  
  assert(allMatch(
    [0, 22, -1, 23].map(yamlFrontMatterRangedS.map),
    [4, 26, undefined, undefined]), "range map");
  assert(allMatch(
    [0, 144 - 62 - 1, 144 - 62].map(pythonChunkS.map),
    [62, 143, undefined]), "range map");
  assert(allMatch(
    [0, 14 - 3 - 1, 14 - 3, 14 - 3 + (33 - 17 - 1), 14 - 3 + (33 - 17)].map(
      chunkMetadataS.map),
    [65, 75, 79, 94, undefined]), "composed range map");


  // now we compose ranged strings with injected newlines, for extra havoc
  const chunkMetadata2S = mappedString(pythonChunkS, [
    { start: 3, end: 13 }, "\n",
    { start: 17, end: 32 }, "\n"
  ]);
  const chunkMetadata3S = mappedString(source, [
    { start: 65, end: 75 }, "\n",
    { start: 79, end: 94 }, "\n",
  ]);

  assert(allMatch(
    [0, 9, 10, 11].map(chunkMetadata2S.map),
    [65, 74, undefined, 79]), "composed range map 2");
  assert(allMatch(
    [0, 9, 10, 11].map(chunkMetadata2S.mapClosest),
    [65, 74, 74, 79]), "composed range map 2");
  assert(allMatch(
    [0, 9, 10, 11].map(chunkMetadata3S.map),
    [65, 74, undefined, 79]), "range map 2");
  assert(allMatch(
    [0, 9, 10, 11].map(chunkMetadata3S.mapClosest),
    [65, 74, 74, 79]), "range map 2");

});
