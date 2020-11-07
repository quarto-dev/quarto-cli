---
title: "plotly"
knit: quarto render
format: 
  html:
    fig-width: 6
    fig-height: 4
jupyter:
  jupytext:
    formats: md
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---

```python label="fig:plotly" caption="my figure" tags=["remove-code"]
import plotly.express as px
df = px.data.iris()
fig = px.scatter(df, x="sepal_width", y="sepal_length", color="species")
fig.show()
```
