---
knit: quarto render
format: 
  pdf: default
jupyter:
  jupytext:
    formats: ipynb,md
    text_representation:
      extension: .md
      format_name: markdown
      format_version: '1.2'
      jupytext_version: 1.6.0
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---


```python
import pandas as pd
d = {'one' : [1., 2., 3., 4.],
     'two' : [4., 3., 2., 1.]}
df = pd.DataFrame(d)
df
```


