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

#show terms.item: it => block(breakable: false)[
  #text(weight: "bold")[#it.term]
  #block(inset: (left: 1.5em, top: -0.4em))[#it.description]
]

// Some quarto-specific definitions.

// Code annotation support
#let quarto-circled-number(n, color: none) = context {
  let c = if color != none { color } else { text.fill }
  box(baseline: 15%, circle(
    radius: 0.55em,
    stroke: 0.5pt + c,
  )[#set text(size: 0.7em, fill: c); #align(center + horizon, str(n))])
}

// Derive a contrasting annotation colour from a background fill.
// Light backgrounds get dark circles; dark backgrounds get light circles.
#let quarto-annote-color(bg) = {
  if type(bg) == color {
    let comps = bg.components(alpha: false)
    let lum = if comps.len() == 1 {
      comps.at(0) / 100%
    } else {
      0.2126 * comps.at(0) / 100% + 0.7152 * comps.at(1) / 100% + 0.0722 * comps.at(2) / 100%
    }
    if lum < 0.5 { luma(200) } else { luma(60) }
  } else {
    luma(60)
  }
}

#let quarto-code-filename(filename, body) = {
  show raw.where(block: true): it => it
  block(width: 100%, radius: 2pt, clip: true, stroke: 0.5pt + luma(200))[
    #set block(spacing: 0pt)
    #block(fill: luma(220), width: 100%, inset: (x: 8pt, y: 4pt))[
      #text(size: 0.85em, weight: "bold")[#filename]]
    #body
  ]
}

#let quarto-code-annotation(annotations, cell-id: "", color: luma(60), body) = {
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
          box(width: 100%)[#it #h(1fr) #link(label(lbl))[#quarto-circled-number(annote-num, color: color)] #label(lbl + "-back")]
        } else {
          box(width: 100%)[#it #h(1fr) #link(label(lbl))[#quarto-circled-number(annote-num, color: color)]]
        }
      } else {
        box(width: 100%)[#it #h(1fr) #quarto-circled-number(annote-num, color: color)]
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
      #link(label(cell-id + "-annote-" + str(n) + "-back"))[#quarto-circled-number(n)]
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

// Style native raw code blocks with default inset, radius, and stroke
#show raw.where(block: true): it => block(
  fill: luma(230), width: 100%, inset: 8pt, radius: 2pt,
  stroke: 0.5pt + luma(200), it,
)

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
