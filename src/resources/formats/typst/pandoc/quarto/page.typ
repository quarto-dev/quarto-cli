#set page(
  paper: $if(papersize)$"$papersize$"$else$"us-letter"$endif$,
$if(margin-layout)$
  margin: (
    left: $margin-geometry.left$,
    right: $margin-geometry.right$,
    top: $if(margin.top)$$margin.top$$else$1.25in$endif$,
    bottom: $if(margin.bottom)$$margin.bottom$$else$1.25in$endif$,
  ),
$elseif(margin)$
  margin: ($for(margin/pairs)$$margin.key$: $margin.value$,$endfor$),
$else$
  margin: (x: 1.25in, y: 1.25in),
$endif$
  numbering: $if(page-numbering)$"$page-numbering$"$else$none$endif$,
  columns: $if(columns)$$columns$$else$1$endif$,
)
$if(logo)$
#set page(background: align($logo.location$, box(inset: $logo.inset$, image("$logo.path$", width: $logo.width$$if(logo.alt)$, alt: "$logo.alt$"$endif$))))
$endif$
$if(margin-layout)$

#import "@preview/drafting:0.2.2": margin-note, set-page-properties, set-margin-note-defaults

#set-page-properties()
#set-margin-note-defaults(
  stroke: none,
  side: right,
  margin-right: $margin-geometry.margin-width$,
)
$endif$
