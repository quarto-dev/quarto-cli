/*
* hover-info.test.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/
import { assert } from "testing/asserts.ts";

import { hover } from "../../../src/core/lib/yaml-intelligence/hover.ts";
import { yamlValidationUnitTest } from "../schema-validation/utils.ts";
import { getYamlIntelligenceResource } from "../../../src/core/lib/yaml-intelligence/resources.ts";

yamlValidationUnitTest("hover-info - simple()", async () => {
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

  const result = await hover({
    code: source,
    position: { row: 7, column: 3 },
    engine: "knitr",
    project_formats: [],
    formats: ["html"],
    path: null,
    filetype: "markdown",
    embedded: false,
    line: "",
  });
  assert(
    result !== null &&
      result.content ===
        // deno-lint-ignore no-explicit-any
        (getYamlIntelligenceResource("schema/cell-codeoutput.yml") as any)[2]
          .description
          .long,
  );
});
