## Light and Dark Mode Testing

This document can be viewed in both light mode and dark mode to test code highlighting in both color schemes.

```{.julia}
function divide_floats(x::Float64, y::Float64)
    return x / y
end
```

And here the inline version `function divide_floats(x::Float64, y::Float64)`{.julia}.

::: {.callout-note}
The tests will automatically check the highlighting in both light and dark modes using Playwright's color scheme testing capabilities.
:::