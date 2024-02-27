/*
 * proejct-default.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 *
 */

import { join } from "../../deno_ral/path.ts";

import { resourcePath } from "../../core/resources.ts";
import { kJupyterEngine } from "../../execute/types.ts";

import { ProjectCreate, ProjectScaffoldFile, ProjectType } from "./types.ts";
import { buildConfluenceFiles } from "./confluence/confluence.ts";

export const kDefaultProjectFileContents = "{ project: { type: 'default' } }";
export const kConfluence = "confluence";

export const defaultProjectType: ProjectType = {
  type: "default",
  templates: [kConfluence],

  formatLibDirs: () => [
    "bootstrap",
    "quarto-html",
    "quarto-ojs",
    "quarto-diagram",
    "quarto-contrib",
  ],

  create: (title: string, template?: string): ProjectCreate => {
    let resourceDirectory = "default";
    if (template === kConfluence) {
      resourceDirectory = "confluence";
    }

    const resourceDir = resourcePath(join("projects", resourceDirectory));

    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: (engine: string, kernel?: string, packages?: string[]) => {
        if (template === kConfluence) {
          return buildConfluenceFiles();
        }

        const file: ProjectScaffoldFile[] = [
          {
            name: title,
            content: `## Quarto

Quarto enables you to weave together content and executable code into a finished document. To learn more about Quarto see <https://quarto.org>.`,
            title,
          },
        ];
        // add some additional content if we were a jupyter engine document created w/
        // matplotlib and/or pandas
        if (
          engine === kJupyterEngine &&
          (!kernel || kernel.startsWith("python")) &&
          packages
        ) {
          file[0].content += `
  
## Running Code

You can embed executable code like this:

\`\`\`{python}
1 + 1
\`\`\`

You can add options to executable code like this

\`\`\`{python}
#| echo: false
2 * 2
\`\`\`

The \`echo: false\` option disables the printing of code (only output is displayed).`;
          if (packages.includes("matplotlib")) {
            file[0].noEngineContent = true;
            file[0].content += `

## Plots

See @fig-polar for an example of rendering plots as figures:

\`\`\`{python}
#| label: fig-polar
#| fig-cap: "A line plot on a polar axis"
#| code-fold: true

import numpy as np
import matplotlib.pyplot as plt

r = np.arange(0, 2, 0.01)
theta = 2 * np.pi * r
fig, ax = plt.subplots(subplot_kw={'projection': 'polar'})
ax.plot(theta, r)
ax.set_rticks([0.5, 1, 1.5, 2])
ax.grid(True)
plt.show()
\`\`\`

Note that we included the cell option \`fold: true\` to hide the code by default (click the *Code* button to show it).`;
          }
        }

        return file;
      },
    };
  },
};
