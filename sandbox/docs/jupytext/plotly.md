---
title: "plotly"
knit: quarto render
format: 
  html:
    fig-width: 8
    fig-height: 3
jupyter:
  jupytext:
    formats: ipynb,md
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---

```python
import plotly.express as px
df = px.data.iris()
fig = px.scatter(df, x="sepal_width", y="sepal_length", color="species")
fig.show()
```



