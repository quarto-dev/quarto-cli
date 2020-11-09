---
title: "Knitr"
output:
   html_document: 
     keep_md: true
---

## Text


```r
cat(1 + 1)
```

```
## 2
```

## Plot


```r
library(ggplot2)
ggplot(mpg, aes(displ, hwy, colour = class)) + 
  geom_point()
```

![](knitr_files/figure-html/unnamed-chunk-2-1.png)<!-- -->
















