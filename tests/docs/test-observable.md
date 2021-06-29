---
title: "Hello Quarto Observable"
format: html
---

## Cell 1, imports and input

```{observable}
import {text} from '@jashkenas/inputs'

viewof name = text({
  title: "what's your name?",
  value: ''
})
```

## Cell 2, output

```{observable}
md`Hello **${name}**, it's nice to meet you!`
```
