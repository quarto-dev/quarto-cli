## Diagrams

```{mermaid}
%%| label: fig-js
%%| fig-cap: "Visible JS caption"
%%| fig-alt: 'A "quoted" label & <tag> with café and 한글'
flowchart LR
  A[Start] --> B[End]
```

```{mermaid}
%%| label: fig-native
%%| fig-cap: "Visible native caption"
flowchart LR
  accTitle: Native title
  accDescr: Native description
  A[Start] --> B[End]
```

```{mermaid}
%%| label: fig-override
%%| fig-alt: "Explicit alternative"
sequenceDiagram
  accTitle: Original title
  accDescr: Longer native description
  Alice->>Bob: Hello
```

```{mermaid}
%%| label: fig-svg
%%| mermaid-format: svg
%%| fig-cap: "Visible SVG caption"
%%| fig-alt: "Static SVG alternative"
flowchart LR
  accTitle: Original static title
  accDescr: Static description
  A[Start] --> B[End]
```

```{mermaid}
%%| label: fig-png
%%| mermaid-format: png
%%| fig-cap: "Visible PNG caption"
%%| fig-alt: "PNG alternative"
flowchart LR
  A[Start] --> B[End]
```

```{mermaid}
%%| label: fig-empty
%%| fig-alt: ""
flowchart LR
  accTitle: Decorative title
  A[Start] --> B[End]
```

```{dot}
//| label: fig-dot
//| fig-cap: "Visible DOT caption"
//| fig-alt: 'DOT "quoted" & <tag> alternative'
digraph G { Start -> End }
```

```{dot}
//| label: fig-dot-empty
//| fig-alt: ""
digraph G { Start -> End }
```

```{mermaid}
%%| fig-alt: >-
%%|   Multiline alternative
%%|   without a caption
flowchart LR
  A[Start] --> B[End]
```

```{dot}
//| fig-alt: "DOT without a caption"
digraph G { Start -> End }
```
