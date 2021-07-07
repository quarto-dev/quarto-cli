/*
* proejct-default.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { resourcePath } from "../../core/resources.ts";
import { kJupyterEngine } from "../../execute/types.ts";

import { ProjectCreate, ProjectScaffoldFile, ProjectType } from "./types.ts";

export const defaultProjectType: ProjectType = {
  type: "default",

  create: (title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "default"));
    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: (engine: string, kernel?: string, packages?: string[]) => {
        const file: ProjectScaffoldFile[] = [{
          name: title,
          content:
            "This is a Quarto document. To learn more about Quarto visit <https://quarto.org>.",
          title,
        }];
        // add some additional content if we were a jupyter engine document created w/
        // matplotlib and/or pandas
        if (
          engine === kJupyterEngine &&
          (!kernel || kernel.startsWith("python")) &&
          packages
        ) {
          if (packages.includes("pandas")) {
            file[0].noEngineContent = true;
            file[0].content += `

Render data frames with:

\`\`\`{python}
import pandas as pd

d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
df
\`\`\``;
          }
          if (packages.includes("matplotlib")) {
            file[0].noEngineContent = true;
            file[0].content += `

Render plots as figures with:

\`\`\`{python}
#| label: fig-polar
#| fig.cap: "A line plot on a polar axis"

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

For illustration see @fig-polar.`;
          }
        }

        return file;
      },
    };
  },
};
