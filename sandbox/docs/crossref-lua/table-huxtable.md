---
title: "Table"
# output:
#   pdf_document: default
format:
  html: 
    keep-md: true
    keep-tex: true
    # crossref: false
    # filters:
    #   - pandoc-crossref
tblPrefix: "tableeee"
---




See @tbl:jj for more.

::: {.cell .cell-code}

```r
ht <- hux(
        Employee = c('John Smith', 'Jane Doe', 'David Hugh-Jones'),
        Salary = c(50000, 50000, 40000),
        add_colnames = TRUE
      )

caption(ht)            <- "My Caption"
bold(ht)[1,]           <- TRUE
bottom_border(ht)[1,]  <- 0.4
align(ht)[,2]          <- 'right'
right_padding(ht)      <- 10
left_padding(ht)       <- 10
width(ht)              <- 0.35
number_format(ht)      <- 2


ht
```

::: {#tbl:jj .output .display_data}
preserve02ac0f2a385a56bc
:::
:::

