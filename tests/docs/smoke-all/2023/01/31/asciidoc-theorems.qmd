---
title: test
format: 
  asciidoc: default
_quarto:
  tests:
    asciidoc: 
      ensureFileRegexMatches:
        - ['<<eq\-black\-scholes>>', '<<lst\-customers>>', '<<thm\-line>>', '\[\#eq\-black\-scholes\]\#', '\[\[thm\-line\]\]', '\[\[lst\-customers\]\]']
        - []
---

## Equations

$$
\frac{\partial \mathrm C}{ \partial \mathrm t } + \frac{1}{2}\sigma^{2} \mathrm S^{2}
\frac{\partial^{2} \mathrm C}{\partial \mathrm C^2}
  + \mathrm r \mathrm S \frac{\partial \mathrm C}{\partial \mathrm S}\ =
  \mathrm r \mathrm C 
$$ {#eq-black-scholes}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vestibulum libero nibh, a mollis est dictum rutrum. Vestibulum quis vestibulum lacus. Proin vitae aliquet ipsum. Suspendisse fermentum magna enim, id pellentesque nibh sollicitudin non. Phasellus ac commodo ipsum, id mattis orci. In augue metus, efficitur eu porta non, congue in nisi. Donec at odio eleifend, eleifend felis id, porttitor nulla.

Ut euismod odio vel dolor porttitor auctor. Nam eu suscipit sem. Integer at rutrum mauris, vel venenatis neque. Sed elementum congue ultrices. Nunc efficitur lectus odio, id hendrerit lacus tincidunt in. Etiam quis elit leo. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse id purus tincidunt, varius ante non, semper urna. Vestibulum auctor condimentum magna, vitae iaculis eros dapibus non. Nunc a vestibulum metus, ut tincidunt odio. Sed egestas suscipit augue, nec porta nibh maximus et. Vestibulum sit amet dolor faucibus tellus dictum gravida. Donec et dictum urna. Cras in ligula est.

Black-Scholes (@eq-black-scholes) is a mathematical model that seeks to explain the behavior of financial derivatives, most commonly options:

## Listings

```{#lst-customers .sql lst-cap="Customers Query"}
SELECT * FROM Customers
```

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vestibulum libero nibh, a mollis est dictum rutrum. Vestibulum quis vestibulum lacus. Proin vitae aliquet ipsum. Suspendisse fermentum magna enim, id pellentesque nibh sollicitudin non. Phasellus ac commodo ipsum, id mattis orci. In augue metus, efficitur eu porta non, congue in nisi. Donec at odio eleifend, eleifend felis id, porttitor nulla.

Ut euismod odio vel dolor porttitor auctor. Nam eu suscipit sem. Integer at rutrum mauris, vel venenatis neque. Sed elementum congue ultrices. Nunc efficitur lectus odio, id hendrerit lacus tincidunt in. Etiam quis elit leo. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse id purus tincidunt, varius ante non, semper urna. Vestibulum auctor condimentum magna, vitae iaculis eros dapibus non. Nunc a vestibulum metus, ut tincidunt odio. Sed egestas suscipit augue, nec porta nibh maximus et. Vestibulum sit amet dolor faucibus tellus dictum gravida. Donec et dictum urna. Cras in ligula est.

Then we query the customers database (@lst-customers).


## Theorem

::: {#thm-line}

## Line

The equation of any straight line, called a linear equation, can be written as:

$$
y = mx + b
$$
:::

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vestibulum libero nibh, a mollis est dictum rutrum. Vestibulum quis vestibulum lacus. Proin vitae aliquet ipsum. Suspendisse fermentum magna enim, id pellentesque nibh sollicitudin non. Phasellus ac commodo ipsum, id mattis orci. In augue metus, efficitur eu porta non, congue in nisi. Donec at odio eleifend, eleifend felis id, porttitor nulla.

Ut euismod odio vel dolor porttitor auctor. Nam eu suscipit sem. Integer at rutrum mauris, vel venenatis neque. Sed elementum congue ultrices. Nunc efficitur lectus odio, id hendrerit lacus tincidunt in. Etiam quis elit leo. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse id purus tincidunt, varius ante non, semper urna. Vestibulum auctor condimentum magna, vitae iaculis eros dapibus non. Nunc a vestibulum metus, ut tincidunt odio. Sed egestas suscipit augue, nec porta nibh maximus et. Vestibulum sit amet dolor faucibus tellus dictum gravida. Donec et dictum urna. Cras in ligula est.

See @thm-line.
