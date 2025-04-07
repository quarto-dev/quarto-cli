/*
* hover-info.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/
import { assert } from "testing/asserts";

import {
  createVirtualDocument,
  hover,
} from "../../../src/core/lib/yaml-intelligence/hover.ts";
import { yamlValidationUnitTest } from "../schema-validation/utils.ts";
import { getYamlIntelligenceResource } from "../../../src/core/lib/yaml-intelligence/resources.ts";
import { YamlIntelligenceContext } from "../../../src/core/lib/yaml-intelligence/types.ts";

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

const context: YamlIntelligenceContext = {
  code: source,
  position: { row: 8, column: 3 },
  engine: "knitr",
  project_formats: [],
  formats: ["html"],
  path: null,
  filetype: "markdown",
  embedded: false,
  line: "",
};

yamlValidationUnitTest("createVirtualDocument - simple()", async () => {
  const result = await createVirtualDocument(context);
  assert(result.doc.length === source.length);
});

yamlValidationUnitTest("hover-info - simple()", async () => {
  const result = await hover(context);

  const hoverInfo = `**code-fold**\n\n${
    // deno-lint-ignore no-explicit-any
    (getYamlIntelligenceResource("schema/cell-codeoutput.yml") as any)[2]
      .description.long
  }`;
  assert(
    result !== null &&
      result.content === hoverInfo,
  );
});
