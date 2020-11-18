---
title: "Pandas"
format:
  html:
    keep-md: true
knit: quarto render
---



::: {.cell .code}
``` {.python}
import pandas as pd
from tabulate import tabulate
from IPython.display import Markdown, display

d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
display(Markdown(tabulate(df, headers=["One", "Two"], tablefmt="github") + "\n\nTable: Here is the Caption"))
```

::: {#tbl:mytable .output .display_data}
|    |   One |   Two |
|----|-------|-------|
|  0 |     1 |     4 |
|  1 |     2 |     3 |
|  2 |     3 |     2 |
|  3 |     4 |     1 |

Table: Here is the Caption
:::
:::

See @tbl:mytable for additional details on this notebook.


