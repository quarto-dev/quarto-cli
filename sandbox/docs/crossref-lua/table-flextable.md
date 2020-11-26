---
title: "Table"
# output:
#   pdf_document: default
format:
  pdf: 
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
ft <- flextable(head(mtcars)) %>% 
  set_caption("My Flex Caption")
ft <- autofit(ft)
ft
```

::: {#tbl:jj .output .display_data}
\includegraphics[width=6.19in,height=2.03in,keepaspectratio]{table-flextable_files/figure-pdf/tbl-jj-1.png}
:::
:::

