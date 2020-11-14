---
knit: quarto render
format:
  html: 
    keep-md: true
jupyter:
  jupytext:
    formats: md,ipynb
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---

```python label="tbl:summary"
import pandas as pd
d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
df
```

See @tbl:summary for additional details.





