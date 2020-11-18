---
title: "Untitled"
format: 
  html:
    keep-md: true
knit: quarto render
---



You can also embed plots, for example:

::: {.cell .code}

```r
knitr::kable(head(mtcars), caption = "Here is the caption")
```

::: {#tbl:foobar-1 .output .display_data}
Table: Here is the caption

|                  |  mpg| cyl| disp|  hp| drat|    wt|  qsec| vs| am| gear| carb|
|:-----------------|----:|---:|----:|---:|----:|-----:|-----:|--:|--:|----:|----:|
|Mazda RX4         | 21.0|   6|  160| 110| 3.90| 2.620| 16.46|  0|  1|    4|    4|
|Mazda RX4 Wag     | 21.0|   6|  160| 110| 3.90| 2.875| 17.02|  0|  1|    4|    4|
|Datsun 710        | 22.8|   4|  108|  93| 3.85| 2.320| 18.61|  1|  1|    4|    1|
|Hornet 4 Drive    | 21.4|   6|  258| 110| 3.08| 3.215| 19.44|  1|  0|    3|    1|
|Hornet Sportabout | 18.7|   8|  360| 175| 3.15| 3.440| 17.02|  0|  0|    3|    2|
|Valiant           | 18.1|   6|  225| 105| 2.76| 3.460| 20.22|  1|  0|    3|    1|
:::

```r
knitr::kable(head(pressure), caption = "Feel the pressure!")
```

::: {#tbl:foobar-2 .output .display_data}
Table: Feel the pressure!

| temperature| pressure|
|-----------:|--------:|
|           0|   0.0002|
|          20|   0.0012|
|          40|   0.0060|
|          60|   0.0300|
|          80|   0.0900|
|         100|   0.2700|
:::
:::

::: {#thm:charles}
### My Caption

asdfasdfasdfasdfsadf
afasdfsdf

$$
math
$$
:::


::: {#fig:pressure .cell .code}
::: {.output .display_data}
![Feeling Pressure](figures_files/figure-html/fig:pressure-1.png){#fig:pressure-1 width=672}
:::

::: {.output .display_data}
![Cars](figures_files/figure-html/fig:pressure-2.png){#fig:pressure-2 width=672}
:::

Foocap
:::

Here is a single plot:

::: {.cell .code}

```r
plot(mtcars)
```

::: {.output .display_data}
![Mtcars](figures_files/figure-html/fig:mtcars-1.png){#fig:mtcars width=672}
:::
:::


Note that the `echo = FALSE` parameter was added to the code chunk to prevent printing of the R code that generated the plot.

::: {.cell .code}
::: {#fig:lungs-1 .output .display_data}
preserve5abebdc369002e42

(Untitled)
:::

::: {#fig:lungs-2 .output .display_data}
preserve25ca78aea1449c80

(Untitled)
:::
:::



@fig:pressure-1

@fig:lungs-2

@tbl:foobar-1

@tbl:foobar-2

