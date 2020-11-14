---
knit: quarto render
format:
  html: 
    keep-md: true
---

::: {.cell .code}
```{.python}
import pandas as pd
d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
df
```

:::{#tbl:summary .output .execute_result}
```{=html}
99d0c6ec-bc8c-4b5a-930a-f3d69c1428f9
```

:::
:::

See @tbl:summary for additional details.






