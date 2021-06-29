---
title: "Hello Quarto Observable"
format: html
---

<!-- // JJA: change to {observable} -->

I wonder if it'll work.

## Cell 1, imports and input

```{ojs}
import {text} from '@jashkenas/inputs'

viewof name = text({
  title: "what's your name?",
  value: ''
})
```

## Cell 2, output

```{ojs}
md`Hello **${name}**, it's nice to meet you!`
```
