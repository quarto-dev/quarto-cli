// Some definitions presupposed by pandoc's typst output.
#let content-to-string(content) = {
  if content.has("text") {
    content.text
  } else if content.has("children") {
    content.children.map(content-to-string).join("")
  } else if content.has("body") {
    content-to-string(content.body)
  } else if content == [ ] {
    " "
  }
}

#let horizontalrule = line(start: (25%,0%), end: (75%,0%))

#let endnote(num, contents) = [
  #stack(dir: ltr, spacing: 3pt, super[#num], contents)
]

#set terms(hanging-indent: 1.5em)

$if(csl-settings)$
// formatting called for by CSL style
#show <refs>: set par(
$if(csl-hanging-indent)$
  hanging-indent: $csl-hanging-indent$,
$endif$
$if(csl-entry-spacing)$
  spacing: $csl-entry-spacing$,
$endif$
)

$endif$
// Some quarto-specific definitions.

// Style of code blocks and of the filename bar. A template or a filter that
// frames code blocks itself can change it for part of the document with
// quarto-code-block-style.update(s => s + (key: value)).
// fill: auto keeps the highlight style or brand background (Skylighting) and
// the set rules (native code blocks); none gives no background.
// stroke, surface and label: auto take colours that suit the code block fill,
// or the page fill when the code block has no fill.
#let quarto-code-block-style-defaults = (
  inset: 8pt,
  radius: 2pt,
  stroke: auto,
  fill: auto,
  surface: auto,
  label: auto,
  title-inset: (x: 8pt, y: 4pt),
)

// True when a colour is dark, by its ITU-R BT.709 relative luminance.
// Anything that is not a colour, such as none or a gradient, counts as light.
#let quarto-color-is-dark(c) = {
  if type(c) != color { return false }
  let (r, g, b) = rgb(c).components(alpha: false).map(v => v / 100%)
  0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5
}

#let quarto-code-block-style = state("quarto-code-block-style", quarto-code-block-style-defaults)

// Merge a code block style over the defaults, and replace an auto stroke,
// surface or label with the colour for the background bg, or for the page fill
// when bg is not a colour. Stops the compile on a key that the defaults do not
// have. Reads the page fill, so call it in context.
#let quarto-code-block-style-resolve(style, bg: auto) = {
  for key in style.keys() {
    if key not in quarto-code-block-style-defaults {
      panic("quarto-code-block-style: unknown key \"" + key + "\". Known keys: "
        + quarto-code-block-style-defaults.keys().join(", ") + ".")
    }
  }
  let resolved = quarto-code-block-style-defaults + style
  let background = if type(bg) == color { bg } else { page.fill }
  let chrome-colors = if quarto-color-is-dark(background) {
    (stroke: 0.5pt + luma(100), surface: luma(55), label: luma(225))
  } else {
    (stroke: 0.5pt + luma(128), surface: luma(220), label: luma(30))
  }
  for (key, value) in chrome-colors {
    if resolved.at(key) == auto { resolved.insert(key, value) }
  }
  resolved
}

// Draw a code block with the current code block style.
// The style fill comes first, then the fill argument; with both auto, the
// block takes its fill from the set rules.
// A style fill also clears the set rule fill of the raw block inside.
// The drawn fill goes in a quarto-code-fill metadata, so that a filename frame
// around the block can match its bar to it.
#let quarto-code-block(fill: auto, body) = context {
  let state-style = quarto-code-block-style.get()
  let block-fill = state-style.at("fill", default: auto)
  if block-fill == auto { block-fill = fill }
  if block-fill == auto { block-fill = block.fill }
  let style = quarto-code-block-style-resolve(state-style, bg: block-fill)
  let args = (width: 100%, inset: style.inset, radius: style.radius, stroke: style.stroke)
  let content = body
  if style.fill != auto {
    args.insert("fill", style.fill)
    content = [#set block(fill: none)
      #body]
  } else if fill != auto {
    args.insert("fill", fill)
  }
  [#metadata(block-fill) <quarto-code-fill>]
  block(..args, content)
}

// Code annotation support

// Derive a contrasting annotation colour from a background fill.
// Light backgrounds get dark circles; dark backgrounds get light circles.
#let quarto-annote-color(bg) = {
  if quarto-color-is-dark(bg) { luma(200) } else { luma(60) }
}

// A circled annotation number. color wins; otherwise, with bg set, the colour
// contrasts with the code block fill (the style fill, else bg); otherwise
// the circle takes the text colour. size sets the text size that the circle
// scales with; auto uses the current text size.
#let quarto-circled-number(n, color: none, bg: auto, size: auto) = context {
  let c = if color != none {
    color
  } else if bg != auto {
    let style = quarto-code-block-style-resolve(quarto-code-block-style.get())
    quarto-annote-color(if style.fill != auto { style.fill } else { bg })
  } else {
    text.fill
  }
  // A template or an extension can wrap code blocks in a broad set block rule.
  // Without this reset, that rule reaches the blocks inside the circle and
  // pushes the circle off its code line.
  set block(width: auto, height: auto, inset: 0pt, outset: 0pt, radius: 0pt, stroke: none, fill: none, spacing: 0pt)
  // A zero-height box lets the circle overflow instead of making its row taller.
  // The 0.55em baseline offset, undone by the move, stops the box from raising its line.
  // The equation wrapper carries the text alternative.
  let circled = box(height: 0pt, baseline: 0.55em, move(dy: -0.63em, math.equation(alt: "Annotation " + str(n), block: false, circle(
    radius: 0.55em,
    stroke: 0.5pt + c,
  )[#set text(size: 0.7em, fill: c); #align(center + horizon, str(n))])))
  if size != auto { text(size: size, circled) } else { circled }
}

// Link to `target` only if that label exists in the document; otherwise
// render `body` unlinked. Keeps annotation rendering resilient when the
// counterpart (annotation item or code line) is missing.
#let quarto-annote-link(target, body) = context {
  if query(label(target)).len() > 0 { link(label(target), body) } else { body }
}

// Frame a code block with a filename bar, styled by quarto-code-block-style.
// The code block inside draws no outline of its own, so the frame shows one.
#let quarto-code-filename(filename, body) = context {
  let previous = quarto-code-block-style.get()
  // The bar matches the fill of the first code block inside this frame,
  // found between here and the end marker of the frame.
  let frame-end = query(selector(<quarto-code-filename-end>).after(here()))
  let body-fills = if frame-end.len() > 0 {
    query(selector(<quarto-code-fill>).after(here()).before(frame-end.first().location()))
  } else { () }
  let body-fill = if body-fills.len() > 0 { body-fills.first().value } else { auto }
  let style = quarto-code-block-style-resolve(previous, bg: body-fill)
  // Long names would be clipped: allow breaks after separators (but not after the
  // last dot, which keeps the extension attached) first, and
  // inside runs of more than 30 characters without a separator
  let filename = if type(filename) == str and filename.len() > 40 {
    filename
      .replace(regex("[/_.-]"), m => m.text + "\u{200b}")
      .replace(regex("[.]\u{200b}([^.]*)\\z"), m => "." + m.captures.at(0))
      .replace(regex("[^/_.\u{200b}-]{31,}"), m => m.text.clusters().join("\u{200b}"))
  } else { filename }
  show raw.where(block: true): it => it
  block(width: 100%, radius: style.radius, clip: true, stroke: style.stroke)[
    #set block(spacing: 0pt)
    #block(fill: style.surface, width: 100%, inset: style.title-inset)[
      #text(size: 0.85em, weight: "bold", fill: style.label)[#filename]]
    #quarto-code-block-style.update(s => s + (stroke: none, radius: 0pt))
    #body
    #quarto-code-block-style.update(previous)
    #metadata(none) <quarto-code-filename-end>
  ]
}

// Native code annotations. The circles are drawn inside the raw block, where
// the text is smaller, so they take the text size from outside the block to
// match the circles of the annotation list. They follow the code text colour.
#let quarto-code-annotation(annotations, cell-id: "", color: none, body) = context {
  let size = text.size
  // Build a set of first-line positions per annotation number so that
  // back-labels are only emitted once (avoiding duplicate labels when
  // one annotation spans multiple lines).
  let first-lines = (:)
  for (line, num) in annotations {
    let key = str(num)
    if key not in first-lines or int(line) < int(first-lines.at(key)) {
      first-lines.insert(key, line)
    }
  }
  show raw.where(block: true): it => it
  show raw.line: it => {
    let annote-num = annotations.at(str(it.number), default: none)
    if annote-num != none {
      if cell-id != "" {
        let lbl = cell-id + "-annote-" + str(annote-num)
        let is-first = first-lines.at(str(annote-num), default: none) == str(it.number)
        if is-first {
          box(width: 100%)[#it #h(1fr) #quarto-annote-link(lbl)[#quarto-circled-number(annote-num, color: color, size: size)] #label(lbl + "-back")]
        } else {
          box(width: 100%)[#it #h(1fr) #quarto-annote-link(lbl)[#quarto-circled-number(annote-num, color: color, size: size)]]
        }
      } else {
        box(width: 100%)[#it #h(1fr) #quarto-circled-number(annote-num, color: color, size: size)]
      }
    } else {
      it
    }
  }
  body
}

#let quarto-annotation-item(cell-id, n, content) = {
  if cell-id != "" {
    [#block(above: 0.4em, below: 0.4em)[
      #quarto-annote-link(cell-id + "-annote-" + str(n) + "-back")[#quarto-circled-number(n)]
      #h(0.4em)
      #content
    ] #label(cell-id + "-annote-" + str(n))]
  } else {
    block(above: 0.4em, below: 0.4em)[
      #quarto-circled-number(n)
      #h(0.4em)
      #content
    ]
  }
}

// Style native raw code blocks with default inset and radius
// Default fill is a set rule so a later `set block(fill: ...)` (brand or user) wins
#show raw.where(block: true): set block(fill: luma(230))
#show raw.where(block: true): it => quarto-code-block(it)

#let block_with_new_content(old_block, new_content) = {
  let fields = old_block.fields()
  let _ = fields.remove("body")
  if fields.at("below", default: none) != none {
    // TODO: this is a hack because below is a "synthesized element"
    // according to the experts in the typst discord...
    fields.below = fields.below.abs
  }
  block.with(..fields)(new_content)
}

#let empty(v) = {
  if type(v) == str {
    // two dollar signs here because we're technically inside
    // a Pandoc template :grimace:
    v.matches(regex("^\\s*$$")).at(0, default: none) != none
  } else if type(v) == content {
    if v.at("text", default: none) != none {
      return empty(v.text)
    }
    for child in v.at("children", default: ()) {
      if not empty(child) {
        return false
      }
    }
    return true
  }

}

// Subfloats
// This is a technique that we adapted from https://github.com/tingerrr/subpar/
#let quartosubfloatcounter = counter("quartosubfloatcounter")

#let quarto_super(
  kind: str,
  caption: none,
  label: none,
  supplement: str,
  position: none,
  subcapnumbering: "(a)",
  body,
) = {
  context {
    let figcounter = counter(figure.where(kind: kind))
    let n-super = figcounter.get().first() + 1
    set figure.caption(position: position)
    [#figure(
      kind: kind,
      supplement: supplement,
      caption: caption,
      {
        show figure.where(kind: kind): set figure(numbering: _ => {
          let subfloat-idx = quartosubfloatcounter.get().first() + 1
          subfloat-numbering(n-super, subfloat-idx)
        })
        show figure.where(kind: kind): set figure.caption(position: position)
        show figure.where(kind: kind): set figure(outlined: false)

        show figure: it => {
          let num = numbering(subcapnumbering, n-super, quartosubfloatcounter.get().first() + 1)
          show figure.caption: it => block({
            num.slice(2) // I don't understand why the numbering contains output that it really shouldn't, but this fixes it shrug?
            [ ]
            it.body
          })

          quartosubfloatcounter.step()
          it
          counter(figure.where(kind: it.kind)).update(n => n - 1)
        }

        quartosubfloatcounter.update(0)
        body
      }
    )#label]
  }
}

// callout rendering
// this is a figure show rule because callouts are crossreferenceable
#show figure: it => {
  if type(it.kind) != str {
    return it
  }
  let kind_match = it.kind.matches(regex("^quarto-callout-(.*)")).at(0, default: none)
  if kind_match == none {
    return it
  }
  let kind = kind_match.captures.at(0, default: "other")
  kind = upper(kind.first()) + kind.slice(1)
  // now we pull apart the callout and reassemble it with the crossref name and counter

  // when we cleanup pandoc's emitted code to avoid spaces this will have to change
  let old_callout = it.body.children.at(1).body.children.at(1)
  let old_title_block = old_callout.body.children.at(0)
  let children = old_title_block.body.body.children
  let old_title = if children.len() == 1 {
    children.at(0)  // no icon: title at index 0
  } else {
    children.at(1)  // with icon: title at index 1
  }

  // TODO use custom separator if available
  // Use the figure's counter display which handles chapter-based numbering
  // (when numbering is a function that includes the heading counter)
  let callout_num = it.counter.display(it.numbering)
  let new_title = if empty(old_title) {
    [#kind #callout_num]
  } else {
    [#kind #callout_num: #old_title]
  }

  let new_title_block = block_with_new_content(
    old_title_block,
    block_with_new_content(
      old_title_block.body,
      if children.len() == 1 {
        new_title  // no icon: just the title
      } else {
        children.at(0) + new_title  // with icon: preserve icon block + new title
      }))

  align(left, block_with_new_content(old_callout,
    block(below: 0pt, new_title_block) +
    old_callout.body.children.at(1)))
}

// 2023-10-09: #fa-icon("fa-info") is not working, so we'll eval "#fa-info()" instead
#let callout(body: [], title: "Callout", background_color: rgb("#dddddd"), icon: none, icon_color: black, body_background_color: white) = {
  block(
    breakable: false, 
    fill: background_color, 
    stroke: (paint: icon_color, thickness: 0.5pt, cap: "round"), 
    width: 100%, 
    radius: 2pt,
    block(
      inset: 1pt,
      width: 100%, 
      below: 0pt, 
      block(
        fill: background_color,
        width: 100%,
        inset: 8pt)[#if icon != none [#text(icon_color, weight: 900)[#icon] ]#title]) +
      if(body != []){
        block(
          inset: 1pt, 
          width: 100%, 
          block(fill: body_background_color, width: 100%, inset: 8pt, body))
      }
    )
}

$if(margin-geometry)$
// Margin layout support using marginalia package
#import "@preview/marginalia:0.3.1" as marginalia: note, notefigure, wideblock

// Render footnote as margin note using standard footnote counter
// Used via show rule: #show footnote: it => column-sidenote(it.body)
// The footnote element already steps the counter, so we just display it
#let column-sidenote(body) = {
  context {
    let num = counter(footnote).display("1")
    // Superscript mark in text
    super(num)
    // Content in margin with matching number
    note(
      alignment: "baseline",
      shift: auto,
      counter: none,  // We display our own number from footnote counter
    )[
      #super(num) #body
    ]
  }
}

// Note: Margin citations are now emitted directly from Lua as #note() calls
// with #cite(form: "full") + locator text, preserving citation locators.

// Utility: compute padding for each side based on side parameter
#let side-pad(side, left-amount, right-amount) = {
  let l = if side == "both" or side == "left" or side == "inner" { left-amount } else { 0pt }
  let r = if side == "both" or side == "right" or side == "outer" { right-amount } else { 0pt }
  (left: l, right: r)
}

// body-outset: extends ~15% into margin area
#let column-body-outset(side: "both", body) = context {
  let r = marginalia.get-right()
  let out = 0.15 * (r.sep + r.width)
  pad(..side-pad(side, -out, -out), body)
}

// page-inset: wideblock minus small inset from page boundary
#let column-page-inset(side: "both", body) = context {
  let l = marginalia.get-left()
  let r = marginalia.get-right()
  // Inset is a small fraction of the extension area (wideblock stops at far)
  let left-inset = 0.15 * l.sep
  let right-inset = 0.15 * (r.sep + r.width)
  wideblock(side: side)[#pad(..side-pad(side, left-inset, right-inset), body)]
}

// screen-inset: full width minus `far` distance from edges
#let column-screen-inset(side: "both", body) = context {
  let l = marginalia.get-left()
  let r = marginalia.get-right()
  wideblock(side: side)[#pad(..side-pad(side, l.far, r.far), body)]
}

// screen-inset-shaded: screen-inset with gray background
#let column-screen-inset-shaded(body) = context {
  let l = marginalia.get-left()
  wideblock(side: "both")[
    #block(fill: luma(245), width: 100%, inset: (x: l.far, y: 1em), body)
  ]
}
$endif$

$if(highlighting-definitions)$
// syntax highlighting functions from skylighting:
$highlighting-definitions$

$endif$
