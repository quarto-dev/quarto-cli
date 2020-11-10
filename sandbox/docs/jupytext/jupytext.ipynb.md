---
title: "Here we go boys"
author: "J.J. Allaire"
knit: quarto render
format:
  html:
    keep-md: true
    self-contained: false
    fig-width: 8
    fig-height: 2
bibliography: references.bib
---

::: {.cell .code class="foo bar" data-tags="include-code,allow-errors,raises-exception"}
```{.python}
print("here we go again")
warnings.warn("we better watch out!")
```

::: {.output .stream .stdout}
```
here we go again

```
:::

::: {.output .stream .stderr}
```
UserWarning: we better watch out!
  warnings.warn("we better watch out!")

```
:::
:::


## Leaflet

::: {.cell .code data-tags="no-execute"}
```{.python}
from ipyleaflet import Map, Marker, basemaps, basemap_to_tiles
m = Map(
    basemap=basemap_to_tiles(basemaps.NASAGIBS.ModisTerraTrueColorCR, "2017-04-08"),
    center=(52.204793, 360.121558),
    zoom=4
)
m.add_layer(Marker(location=(52.204793, 360.121558)))
m
```
:::


## Visual Editor

@pirzada2020

## iTables

::: {.cell .code}
```{.python}
import itables.interactive
import world_bank_data as wb

df = wb.get_countries()
df
```

::: {.output .display_data}
```{=html}
<script type="application/javascript">
require.config({
    paths: {
        datatables: 'https://cdn.datatables.net/1.10.19/js/jquery.dataTables.min',
    }
});

$('head').append('<link rel="stylesheet" type="text/css" \
                href = "https://cdn.datatables.net/1.10.19/css/jquery.dataTables.min.css" > ');

$('head').append('<style> table td { text-overflow: ellipsis; overflow: hidden; } </style>');

$('head').append(`<script>
function eval_functions(map_or_text) {
    if (typeof map_or_text === "string") {
        if (map_or_text.startsWith("function")) {
            try {
                // Note: parenthesis are required around the whole expression for eval to return a value!
                // See https://stackoverflow.com/a/7399078/911298.
                //
                // eval("local_fun = " + map_or_text) would fail because local_fun is not declared
                // (using var, let or const would work, but it would only be declared in the local scope
                // and therefore the value could not be retrieved).
                const func = eval("(" + map_or_text + ")");
                if (typeof func !== "function") {
                    // Note: backquotes are super convenient!
                    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
                    console.error("Evaluated expression " + map_or_text + " is not a function (type is " + typeof func + ")");
                    return map_or_text;
                }
                // Return the function
                return func;
            } catch (e) {
                // Make sure to print the error with a second argument to console.error().
                console.error("itables was not able to parse " + map_or_text, e);
            }
        }
    } else if (typeof map_or_text === "object") {
        if (map_or_text instanceof Array) {
            // Note: "var" is now superseded by "let" and "const".
            // https://medium.com/javascript-scene/javascript-es6-var-let-or-const-ba58b8dcde75
            const result = [];
            // Note: "for of" is the best way to iterate through an iterable.
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
            for (const item of map_or_text) {
                result.push(eval_functions(item));
            }
            return result;

            // Alternatively, more functional approach in one line:
            // return map_or_text.map(eval_functions);
        } else {
            const result = {};
            // Object.keys() is safer than "for in" because otherwise you might have keys
            // that aren't defined in the object itself.
            //
            // See https://stackoverflow.com/a/684692/911298.
            for (const item of Object.keys(map_or_text)) {
                result[item] = eval_functions(map_or_text[item]);
            }
            return result;
        }
    }

    return map_or_text;
}
</` + 'script>');
</script>
```
:::

::: {.output .execute_result}
```{=html}
8684c99c-7105-43da-8b85-32d92ec7db18
```

:::
:::

## Plotly FTW

::: {.cell .code data-tags="no-execute"}
```{.python}
import plotly.graph_objects as go
fig = go.Figure(
    data=[go.Bar(y=[2, 1, 3])],
    layout_title_text="A Figure Displayed with fig.show()"
)
fig.show()
```
:::

## Slide with Plot

::: {.cell .code class=".rich .internet .output" foo="bar" id="myplot" data-tags="include-code"}
```{.python}
import matplotlib.pyplot as plt
from IPython.display import set_matplotlib_formats
import inspect

plt.rcParams['figure.figsize'] = 10, 2
set_matplotlib_formats('pdf')

labels = ['G1', 'G2', 'G3', 'G4', 'G6']
men_means = [20, 35, 30, 35, 27]
women_means = [25, 32, 34, 20, 25]
men_std = [2, 3, 4, 1, 2]
women_std = [3, 5, 2, 3, 3]
width = 0.35       # the width of the bars: can also be len(x) sequence

fig, ax = plt.subplots()

ax.bar(labels, men_means, width, yerr=men_std, label='Men')
ax.bar(labels, women_means, width, yerr=women_std, bottom=men_means,
       label='Women')

ax.set_ylabel('Scores')
ax.set_title('Scores broken out by group and gender')
ax.legend()
plt.show()
```

::: {.output .display_data}
<Figure size 960x192 with 1 Axes>
:::
:::


## Next Slide

::: {.cell .code}
```{.python}
from jupytext.config import find_jupytext_configuration_file
find_jupytext_configuration_file('.')
```
:::







