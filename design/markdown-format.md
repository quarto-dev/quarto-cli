---
title: "Quarto Markdown Serialization"
format: html
---

## Objectives

-   Common chunk option syntax that works well with existing Jupyter front-ends (which have terrible or non-existent cell metadata editing UI)
-   Backwards compatibility with `.md`, `.Rmd`, and `.ipynb`
-   Ability to determine the computation engine (knitr, jupyter, or none) for a given input file
-   Ability of editors and front ends to detect when Quarto tooling should be enabled (e.g. render button, visual editor, etc.)

## File Extension

For compatibility, quarto can render:

-   `.md` (no code chunks)
-   `.rmd` (migrate existing rmds to quarto formats)
-   `.ipynb` (for jupyter notebook front end users)

However, for new markdown content Quarto will prefer:

-   `.qmd`, which indicates Quarto extensions (including code chunks) are in use (note that `.rmd` is essentially a convenience synonym for `.qmd`)

We could just use `.md`, but then:

-   GitHub would render the markdown rather than showing you the source code
-   Rendering markdown from Quarto would become more awkward (would need some sort of meta file extension)
-   Editors that know how to edit Quarto would have to override the `.md` file extension and/or compete for the extension with other applications
-   Detecting Quarto content would require "sniffing" inside the .md
-   Markdown "reformatters" in generic text editors could maul the code and make it un-executable (that literally happened to me editing a Quarto file in VS Code)

In short, the .Rmd file extension served us well in R Markdown and we'd rather not have both Rmd and Jmd (and then e.g. Zmd for Apache Zepplin). Better to use .qmd and have content inside the file distinguish the computation engine.

## Chunk Options

Code chunks encoded with language and YAML chunk options in a comment:

**knitr**

```` {.r}
```{r}
#| label: fig:air-quality
#| echo: false

library(ggplot2)
ggplot(airquality, aes(Temp, Ozone)) + 
       geom_point() + 
       geom_smooth(method = "loess", se = FALSE)
```
````

**jupyter**

```` {.python}
```{python}
#| label: tbl:random
#| echo: false

import pandas as pd
d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
df
```
````

There will be a huge benefit to sharing chunk option encoding syntax across engines, since we won't need to repeat documentation for things like figure/layout options or cross-references once per computation engine.

## Computation Engine

The computation engine could be specified explicitly, e.g.

``` {.markdown}
---
title: "Report"
knitr: true
---
```

``` {.markdown}
---
title: "Report"
jupyter: python3
---
```

Or with a generic `engine` or `execute` option:

``` {.markdown}
---
title: "Report"
execute: knitr
---
```

``` {.markdown}
---
title: "Report"
execute: jupyter:python3
---
```

But note that both Jupyter and Knitr can have additional options, e.g.:

``` {.markdown}
---
title: "Report"
jupyter:
  kernel: python3
  run-cells: true
  cache: true
---
```

So probably best to stick with this syntax rather than add a new `execute` option that would compete with it.

Note that we can also determine the computation engine implicitly. Any file with ```` ```{r} ```` chunks is knitr and otherwise is jupyter:

**knitr**

```` {.markdown}
---
title: "Report"
---

```{r}
1 + 1
```
````

**jupyter**

```` {.markdown}
--- 
title: "Report"
---

```{python}
1 + 1
```
````

You could override this explicitly for e.g. a knitr document that had only Python chunks:

**knitr (python)**

```` {.markdown}
--- 
title: "Report"
knitr: true
----

```{python}
1 + 1
```
````

**jupyter (r)**

Or for a Jupyter document that wanted to use the R kernel:

```` {.markdown}
---
title: "Report"
jupyter: r
---

```{r}
1 + 1
```
````
