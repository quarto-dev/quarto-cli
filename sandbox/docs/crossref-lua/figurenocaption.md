---
title: "Figure"
format:
  html: 
    keep-md: true
    # crossref: false
    # filters:
    #   - pandoc-crossref
crossref:
  title-delim: ":"
  subfig-captions: false
knit: quarto render
---

::: {.foobar}

::: {#fig:markdown}
Here is my figure

My Caption, My Caption
:::

:::




::: {.myparent}
::: {.myclass}
![Caption](https://www.lua.org/pil/capa.jpg){#fig:lua}
:::
:::



::: {#fig:parent .cell .code}

```r
plot(cars)
plot(pressure)
```

::: {.output .display_data}
![Cars](figure_files/figure-html/fig:parent-1.png){#fig:parent-1 .nocaption width=672}
:::

::: {.output .display_data}
![Pressure](figure_files/figure-html/fig:parent-2.png){#fig:parent-2 width=672}
:::

Everything
:::


::: {.cell .code}

```r
plot(pressure)
```

::: {.output .display_data}
![Show the pressure](figure_files/figure-html/fig:pressure-1.png){#fig:pressure width=672}
:::
:::


See @fig:cars again.

See @fig:pressure.


