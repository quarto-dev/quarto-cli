---
format:
  markdown:
    keep-hidden: true
knit: quarto render
output:
  md_document: default
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
``` {.r .hidden}
library(ggplot2)
ggplot(mpg, aes(displ, hwy, colour = class)) + 
  geom_point()
```

::: {.output .display_data}
![](knitr-hide_files/figure-markdown/unnamed-chunk-2-1.png)
:::

``` {.r .hidden}
warning("Be warned!")
```

::: {.output .stream .stderr}
    Warning: Be warned!
:::
:::
