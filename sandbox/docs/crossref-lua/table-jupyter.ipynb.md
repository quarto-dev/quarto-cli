---
title: "Tables"
format: 
   html: 
     keep-md: true
---



::: {.cell .cell-code data-tags="hide-code"}

::: {#tbl:html .output .display_data}
```{=html}

<table style='margin: 0 auto'>
<caption>Here is the caption</caption>
<tr><th>Hi!</th><th>There!</th></tr>
<tr><td>1</td><td>2</td></tr>
</table>
```
:::
:::

::: {#tbl:htmltabulate}
This is my table

::: {.cell .cell-code data-tags="hide-code"}

::: {.output .execute_result}
```{=html}
<table>
<thead>
<tr><th style="text-align: right;">  </th><th style="text-align: right;">  One</th><th style="text-align: right;">  Two</th></tr>
</thead>
<tbody>
<tr><td style="text-align: right;"> 0</td><td style="text-align: right;">    1</td><td style="text-align: right;">    4</td></tr>
<tr><td style="text-align: right;"> 1</td><td style="text-align: right;">    2</td><td style="text-align: right;">    3</td></tr>
<tr><td style="text-align: right;"> 2</td><td style="text-align: right;">    3</td><td style="text-align: right;">    2</td></tr>
<tr><td style="text-align: right;"> 3</td><td style="text-align: right;">    4</td><td style="text-align: right;">    1</td></tr>
</tbody>
</table>
```
:::
:::

:::



::: {.cell .cell-code}
``` {.python}
import pandas as pd
from tabulate import tabulate
from IPython.display import Markdown, display

d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
Markdown(tabulate(df, headers=["One", "Two"], tablefmt="github") + "\n\n: Here is the Caption")
```

::: {#tbl:mytable .output .execute_result}
|    |   One |   Two |
|----|-------|-------|
|  0 |     1 |     4 |
|  1 |     2 |     3 |
|  2 |     3 |     2 |
|  3 |     4 |     1 |

: Here is the Caption
:::
:::

See @tbl:mytable for additional details on this notebook.


