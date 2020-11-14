---
title: "Woozy Foobar"
knit: quarto render
quarto:
  html:
    toc: true
    number-sections: true
    keep-md: true
bibliography: references.bib
fontsize: 30px
---

[@guo2020]


```r
str(params)
```

```
 NULL
```

```r
str(getwd())
```

```
 chr "/Users/jjallaire/quarto/quarto-cli/sandbox/docs/pdflatex"
```

# Plot 1: Target

-   bullet 1

-   bullet 2

-   bullet 3

# Plot 2


```r
plot(cars)
```

<img src="test_files/figure-html/unnamed-chunk-2-1.png" width="672" />


### Hello world


```r
plot(cars)
```

<img src="test_files/figure-html/gui-boy-1.png" width="672" />

# Plot 3


```r
str(pressure)
```

```
'data.frame':	19 obs. of  2 variables:
 $ temperature: num  0 20 40 60 80 100 120 140 160 180 ...
 $ pressure   : num  0.0002 0.0012 0.006 0.03 0.09 0.27 0.75 1.85 4.2 8.8 ...
```

```r
str(cars)
```

```
'data.frame':	50 obs. of  2 variables:
 $ speed: num  4 4 7 7 8 9 10 10 10 11 ...
 $ dist : num  2 10 4 22 16 10 18 26 34 17 ...
```

# References
