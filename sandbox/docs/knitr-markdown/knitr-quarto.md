---
format:
  markdown:
    output-file: knitr-quarto.md
knit: quarto render
output:
  html_document:
    keep_md: true
title: Knitr
---

## Text

::: {.cell .code}
``` {.r}
cat(1 + 1)
```

::: {.output .stream .stdout}
    2
:::
:::

## Plot

::: {.cell .code}
``` {.r}
library(ggplot2)
```

``` {.r}
ggplot(mpg, aes(displ, hwy, colour = class)) + 
  geom_point()
```

::: {.output .display_data}
![](knitr_files/figure-markdown/unnamed-chunk-2-1.png)
:::
:::
