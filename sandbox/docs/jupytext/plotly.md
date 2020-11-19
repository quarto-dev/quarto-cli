---
title: "plotly"
knit: quarto render
format: 
  html:
    fig-width: 8
    fig-height: 6
    keep-md: true
jupyter:
  jupytext:
    formats: md,ipynb
---

```python fig.cap="my figure" label="fig:plotly" tags=["remove-code"]
import plotly.express as px
df = px.data.iris()
fig = px.scatter(df, x="sepal_width", y="sepal_length", color="species")
fig.show()
```
