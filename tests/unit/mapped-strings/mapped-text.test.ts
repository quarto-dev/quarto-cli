/*
* mapped-text.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/
import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  asMappedString,
  mappedDiff,
  mappedString,
} from "../../../src/core/mapped-text.ts";
import {
  mappedSubstring,
  mappedTrim,
  mappedTrimEnd,
  mappedTrimStart,
} from "../../../src/core/lib/mapped-text.ts";

// deno-lint-ignore require-await
unitTest("mapped-text - mappedString()", async () => {
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

  const yamlFrontMatterRangedS = mappedSubstring(source, 4, 27);
  const pythonChunkS = mappedString(source, [
    { start: 62, end: 144 },
  ]);

  // this tests composition of ranged strings
  const chunkMetadataS = mappedString(pythonChunkS, [
    { start: 3, end: 14 },
    { start: 17, end: 33 },
  ]);

  // deno-lint-ignore no-explicit-any
  function allMatch(a: any[], b: any[]) {
    return a.every((v, i) => v === b[i]);
  }

  assert(
    allMatch(
      [0, 22, -1, 23].map((n) => yamlFrontMatterRangedS.map(n)?.index),
      [4, 26, undefined, undefined],
    ),
    "range map 1",
  );
  assert(
    allMatch(
      [0, 144 - 62 - 1, 144 - 62].map((n) => pythonChunkS.map(n)?.index),
      [62, 143, undefined],
    ),
    "range map 2",
  );
  assert(
    allMatch(
      [0, 14 - 3 - 1, 14 - 3, 14 - 3 + (33 - 17 - 1), 14 - 3 + (33 - 17)].map(
        (n) => chunkMetadataS.map(n)?.index,
      ),
      [65, 75, 79, 94, undefined],
    ),
    "composed range map",
  );

  // now we compose ranged strings with injected newlines, for extra havoc
  const chunkMetadata2S = mappedString(pythonChunkS, [
    { start: 3, end: 13 },
    "\n",
    { start: 17, end: 32 },
    "\n",
  ]);
  const chunkMetadata3S = mappedString(source, [
    { start: 65, end: 75 },
    "\n",
    { start: 79, end: 94 },
    "\n",
  ]);
  assert(
    allMatch(
      [0, 9, 10, 11].map((n) => chunkMetadata2S.map(n)?.index),
      [65, 74, 0, 79],
    ),
    "composed range map 2",
  );
  assert(
    allMatch(
      [0, 9, 10, 11].map((n) => chunkMetadata2S.map(n, true)?.index),
      [65, 74, 0, 79],
    ),
    "composed range map 3",
  );
  assert(
    allMatch(
      [0, 9, 10, 11].map((n) => chunkMetadata3S.map(n)?.index),
      [65, 74, 0, 79],
    ),
    "range map 3",
  );
  assert(
    allMatch(
      [0, 9, 10, 11].map((n) => chunkMetadata3S.map(n, true)?.index),
      [65, 74, 0, 79],
    ),
    "range map 4",
  );
});

// deno-lint-ignore require-await
unitTest("mapped-text - mappedDiff()", async () => {
  const text1 = `---
title: "ojs syntax error"
format: html
---

## Let's add some knitr line number interference

This should make it harder for the lines to come out right:

\`\`\`{r}
rnorm(100)
\`\`\`

## Syntax Error here

\`\`\`{ojs}
// Let's forget this is JS to force a syntax error
viewof x = Inputs.range([0, 100], label = "hello!", value = 20)
\`\`\`
`;

  const text2 = `---
title: "ojs syntax error"
format: html
---

## Let's add some knitr line number interference

This should make it harder for the lines to come out right:

::: {.cell}

\`\`\`{.r .cell-code}
rnorm(100)
\`\`\`

::: {.cell-output-stdout}
\`\`\`
##   [1] -0.717725302 -0.242773543 -0.278330877 -0.295613695 -0.123735080
##   [6]  0.232292643 -0.489511306 -2.408335922  0.905536173  0.865255767
##  [11] -0.198943605  0.015560360  0.655278593  0.019608002 -0.894545892
##  [16]  0.614554271 -0.002447532 -1.873361215  1.109782136 -0.984856650
##  [21]  0.626415126  0.304848855  1.423643404 -0.006210320 -1.366947113
##  [26]  0.143371793  1.207872196  0.925073210  1.280760236  1.074683915
##  [31] -1.362349941 -0.071914857  2.213405782  0.314567108  0.447236991
##  [36] -1.473838506 -1.747889158 -0.401329546  0.690835240  1.073928009
##  [41] -1.647715834 -1.277902617 -1.845625083  1.597834481 -0.995791270
##  [46]  0.267281987 -1.566991308 -0.816110546  0.277625032  1.142689151
##  [51] -0.982363252  0.862736694 -0.046169092 -0.004287121  0.232999659
##  [56] -0.318900321 -0.491032649 -0.168216245 -0.091973320 -0.978739524
##  [61] -0.270792788  0.726650048 -1.001422491 -0.621582296  0.816793861
##  [66] -1.433459384 -0.787385931 -0.258746719 -0.672616331  0.272171651
##  [71]  1.047042398 -0.768357307  0.110871645 -0.896096933 -0.460021901
##  [76] -0.383200018 -0.902422165  0.865603287  0.701839145  0.267261820
##  [81]  0.197888901 -0.290371774  1.782868793  0.051206937  0.866067094
##  [86]  0.491884009  0.430615289  0.842136765 -1.350299928  0.518278232
##  [91]  0.619646456 -1.350406731 -0.136478983  0.005902266 -0.670544605
##  [96]  0.602516438 -0.789907293  1.294085153 -1.100722511  0.143690310
\`\`\`
:::
:::

## Syntax Error here

\`\`\`{ojs}
// Let's forget this is JS to force a syntax error
viewof x = Inputs.range([0, 100], label = "hello!", value = 20)
\`\`\`
`;

  mappedDiff(asMappedString(text1), text2);
});

// deno-lint-ignore require-await
unitTest("mapped-text - mappedTrim{,Start,End}()", async () => {
  const whitespace = "\u000A\u000D\u2028\u2029\u0009\u000B\u000C\uFEFF \t";
  const content = "a \n";
  for (let i = 0; i < 1000; ++i) {
    const startTrimLength = Math.random() * 10;
    const endTrimLength = Math.random() * 10;
    const contentLength = Math.random() * 10;
    const strContent = [];
    for (let j = 0; j < startTrimLength; ++j) {
      strContent.push(whitespace[~~(Math.random() * whitespace.length)]);
    }
    for (let j = 0; j < contentLength; ++j) {
      strContent.push(content[~~(Math.random() * content.length)]);
    }
    for (let j = 0; j < endTrimLength; ++j) {
      strContent.push(whitespace[~~(Math.random() * whitespace.length)]);
    }
    const mappedStr = asMappedString(strContent.join(""));
    assertEquals(mappedTrim(mappedStr).value, mappedStr.value.trim());
    assertEquals(mappedTrimStart(mappedStr).value, mappedStr.value.trimStart());
    assertEquals(mappedTrimEnd(mappedStr).value, mappedStr.value.trimEnd());
  }
});
