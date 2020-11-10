---
title: "Untitled"
format:
  html:
    keep-md: true
    cache: all
knit: quarto render
---

## R Markdown

```{=latex}
\textbf{some bold text}
```

This is an R Markdown document. Markdown is a simple formatting syntax for authoring HTML, PDF, and MS Word documents. For more details on using R Markdown see <http://rmarkdown.rstudio.com>.

When you click the **Knit** button a document will be generated that includes both content as well as the output of any embedded R code chunks within the document. You can embed an R code chunk like this:

::: {.cell .code}

```r
Sys.sleep(5)
summary(cars)
```

::: {.output .stream .stdout}

```
     speed           dist
 Min.   : 4.0   Min.   :  2.00
 1st Qu.:12.0   1st Qu.: 26.00
 Median :15.0   Median : 36.00
 Mean   :15.4   Mean   : 42.98
 3rd Qu.:19.0   3rd Qu.: 56.00
 Max.   :25.0   Max.   :120.00
```

:::
:::

## Including Plots

You can also embed plots, for example:

::: {.cell .code}

```r
plot(pressure)
```

::: {.output .display_data}

<div class="figure">
<img src="test-r_files/figure-html/unnamed-chunk-1-1.png" alt="Presure Time" width="672" />
<p class="caption">Presure Time</p>
</div>
:::
:::

Note that the `echo = FALSE` parameter was added to the code chunk to prevent printing of the R code that generated the plot.
