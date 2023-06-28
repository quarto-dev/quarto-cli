---
title: Crossref Test
---

## Simple Figure

![Elephant](img/thinker.jpg){#fig-elephant}

See @fig-elephant for an illustration

## Simple Sub Figure

::: {#fig-elephants layout-ncol=2}

![Surus](img/surus.jpg){#fig-surus}

![Abbas](img/abbas.jpg){#fig-abbas}

Famous Elephants
:::

See @fig-elephants for examples. In particular, @fig-abbas.

## Simple Crossref Table

| Col1 | Col2 | Col3 |
| ---- | ---- | ---- |
| A    | B    | C    |
| E    | F    | G    |
| A    | G    | G    |

: My Caption {#tbl-letters}

See @tbl-letters.

## Sub tables

::: {#tbl-panel layout-ncol=2}
| Col1 | Col2 | Col3 |
|------|------|------|
| A | B | C |
| E | F | G |
| A | G | G |

: First Table {#tbl-first}

| Col1 | Col2 | Col3 |
| ---- | ---- | ---- |
| A    | B    | C    |
| E    | F    | G    |
| A    | G    | G    |

: Second Table {#tbl-second}

Main Caption
:::

See @tbl-panel for details, especially @tbl-second.

## Math

::: {#thm-line}

## Line

The equation of any straight line, called a linear equation, can be written as:

$$
y = mx + b
$$

:::

See @thm-line.


```{#lst-customers .sql lst-cap="Customers Query"}
SELECT * FROM Customers
```

Then we query the customers database (@lst-customers).


## A section to be referenced {#sec-section}

See @sec-section.

## Equations

Black-Scholes (@eq-black-scholes) is a mathematical model that seeks to explain the behavior of financial derivatives, most commonly options:

$$
\frac{\partial \mathrm C}{ \partial \mathrm t } + \frac{1}{2}\sigma^{2} \mathrm S^{2}
\frac{\partial^{2} \mathrm C}{\partial \mathrm C^2}
  + \mathrm r \mathrm S \frac{\partial \mathrm C}{\partial \mathrm S}\ =
  \mathrm r \mathrm C 
$$ {#eq-black-scholes}

