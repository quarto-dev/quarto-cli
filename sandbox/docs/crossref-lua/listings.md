---
title: "Listings"
format: 
  pdf:
    keep-md: true
    keep-tex: true
    keep-hidden: true
    crossref: true
    # filters:
    #   - pandoc-crossref
    #   - citeproc
    listings: false
codeBlockCaptions: true
---

## Listing {#sec:listing}


See @lst:cars for more.

See @fig:cars for the visualization.

::: {.cell .cell-code}

```{#lst:cars .r .woozy .foobar  caption="Some Cars"}
plot(cars)
```

::: {.output .display_data}
![Cars Caption](listings_files/figure-pdf/fig-cars-1.pdf){#fig:cars}
:::
:::



Here we go with a listing for you!

``` {#lst:simple .python lst.cap="A Simple Function"}
def foobar():
  return "hello"
```

``` {#lst:simple2 .python lst.cap="A Simple Function"}
def foobar():
  return "hello"
```

``` {.python lst.cap="A Simple Function"}
def foobar():
  return "hello"
```


``` {#lst:simple3 .python lst.cap="A Simple Function"}
def foobar():
  return "hello"
```


``` {.python lst.cap="A Simple Function"}
def foobar():
  return "hello"
```


``` {.python lst.cap="A Simple Function"}
def foobar():
  return "hello"
```


``` {#lst:simple4 .python lst.cap="A Simple Function"}
def foobar():
  return "hello"
```



## Here we go again

: A **Simple** Function {#lst:simple}




