---
title: "plotly"
knit: quarto render
format: 
  revealjs:
    fig-width: 8
    fig-height: 3
jupyter:
  jupytext:
    formats: md
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---

```python tags=["remove-code"]
import plotly.express as px
df = px.data.iris()
fig = px.scatter(df, x="sepal_width", y="sepal_length", color="species")
fig.show()
```

Pandoc powered scientific and technical documents.

- PIkc your

none
R
Ju
Julia

