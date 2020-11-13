---
title: "Test crossrefs"
format:
   pdf:  
     keep-md: true
     keep-tex: true
knit: quarto render
linkReferences: true
nameInLink: true
bibliography: references.bib
---

[@pirzada2020]


```{.haskell}
main :: IO ()
main = putStrLn "Hello World!"
```

: Caption {#lst:code}


::: {.cell .code}

```r
knitr::kable(
  head(mtcars[, 1:8], 10), booktabs = TRUE,
  caption = 'A table of the first 10 rows of the mtcars data.'
)
```



Table: A table of the first 10 rows of the mtcars data.

|                  |  mpg| cyl|  disp|  hp| drat|    wt|  qsec| vs|
|:-----------------|----:|---:|-----:|---:|----:|-----:|-----:|--:|
|Mazda RX4         | 21.0|   6| 160.0| 110| 3.90| 2.620| 16.46|  0|
|Mazda RX4 Wag     | 21.0|   6| 160.0| 110| 3.90| 2.875| 17.02|  0|
|Datsun 710        | 22.8|   4| 108.0|  93| 3.85| 2.320| 18.61|  1|
|Hornet 4 Drive    | 21.4|   6| 258.0| 110| 3.08| 3.215| 19.44|  1|
|Hornet Sportabout | 18.7|   8| 360.0| 175| 3.15| 3.440| 17.02|  0|
|Valiant           | 18.1|   6| 225.0| 105| 2.76| 3.460| 20.22|  1|
|Duster 360        | 14.3|   8| 360.0| 245| 3.21| 3.570| 15.84|  0|
|Merc 240D         | 24.4|   4| 146.7|  62| 3.69| 3.190| 20.00|  1|
|Merc 230          | 22.8|   4| 140.8|  95| 3.92| 3.150| 22.90|  1|
|Merc 280          | 19.2|   6| 167.6| 123| 3.92| 3.440| 18.30|  1|
:::



## Image

![Caption](file.jpg){#fig:label width="100" height="100"}

## Table

| Col1 | Col2 | Col3 |
|------|------|------|
| a    |      |      |
|      |      |      |
|      |      | c    |

: This is the caption {#tbl:label}

## Section {#sec:section}

This is a section

See @fig:label for more.

See @eq:label for an equation.

See @tbl:label for a table.

See section @sec:section.

## Math

$$ 
math 
$$ {#eq:label}

