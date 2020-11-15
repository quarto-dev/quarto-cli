---
title: "Pandas"
format:
  html: default
crossref: false
knit: quarto render
jupyter: true
---


```python
import pandas as pd
d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
df
```

See @tbl:summary for additional details on this notebook.

