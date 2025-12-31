#set page(
  paper: $if(papersize)$"$papersize$"$else$"us-letter"$endif$,
$if(margin-layout)$
  // Margins handled by marginalia.setup below
$elseif(margin)$
  margin: ($for(margin/pairs)$$margin.key$: $margin.value$,$endfor$),
$else$
  margin: (x: 1.25in, y: 1.25in),
$endif$
  numbering: $if(page-numbering)$"$page-numbering$"$else$none$endif$,
)
$if(logo)$
#set page(background: align($logo.location$, box(inset: $logo.inset$, image("$logo.path$", width: $logo.width$$if(logo.alt)$, alt: "$logo.alt$"$endif$))))
$endif$
$if(margin-layout)$

#import "@preview/marginalia:0.3.1" as marginalia: note, notefigure, wideblock

#show: marginalia.setup.with(
  inner: (
    far: 0in,
    width: 0in,
    sep: $margin-geometry.inner-sep$,
  ),
  outer: (
    far: $margin-geometry.outer-far$,
    width: $margin-geometry.outer-width$,
    sep: $margin-geometry.outer-sep$,
  ),
  top: $if(margin.top)$$margin.top$$else$1.25in$endif$,
  bottom: $if(margin.bottom)$$margin.bottom$$else$1.25in$endif$,
  book: false,
  clearance: 8pt,
)

// Render footnote as margin note using standard footnote counter
// This is consistent with LaTeX's sidenotes package behavior
#let quarto-sidenote(body) = {
  counter(footnote).step()
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

// Margin citation - inline citation + full bibliographic entry in margin
// Each citation key gets the inline citation, with full entry appearing in margin
#let quarto-margin-cite(..labels) = {
  // Render inline citations
  for label in labels.pos() {
    cite(label)
  }
  // Full citation entries in margin
  note(
    alignment: "baseline",
    shift: auto,
    counter: none,
  )[
    #set text(size: 0.85em)
    #for label in labels.pos() [
      #cite(label, form: "full")
    ]
  ]
}
$endif$
