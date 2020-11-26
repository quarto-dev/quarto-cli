---
title: "Tables"
format: 
   html: 
     keep-md: true
jupyter: true
---



```python label="tbl:html" tags=["hide-code"]
from IPython.core.display import display, HTML
display(HTML("""
<table style='margin: 0 auto'>
<caption>Here is the caption</caption>
<tr><th>Hi!</th><th>There!</th></tr>
<tr><td>1</td><td>2</td></tr>
</table>
"""))
```

::: {#tbl:htmltabulate}
This is my table

```python tags=["hide-code"]
import pandas as pd
from tabulate import tabulate

d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
tabulate(df, headers=["One", "Two"], tablefmt="html")
```
:::



```python label="tbl:mytable"
import pandas as pd
from tabulate import tabulate
from IPython.display import Markdown, display

d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
Markdown(tabulate(df, headers=["One", "Two"], tablefmt="github") + "\n\n: Here is the Caption")
```

See @tbl:mytable for additional details on this notebook.

