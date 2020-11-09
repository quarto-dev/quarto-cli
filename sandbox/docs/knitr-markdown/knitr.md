Text
----

    cat(1 + 1)

    ## 2

Warning
-------

    warning("Be warned!")

    ## Warning: Be warned!

Plot
----

    library(ggplot2)
    ggplot(mpg, aes(displ, hwy, colour = class)) + 
      geom_point()

![](knitr_files/figure-markdown_strict/unnamed-chunk-3-1.png)
