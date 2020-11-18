---
title: "itables"
knit: quarto render
jupyter:
  jupytext:
    formats: ipynb,md
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---

```python label="tbl:countries"
import itables.interactive
import world_bank_data as wb

df = wb.get_countries()
df
```
