#set page(
  paper: $if(papersize)$"$papersize$"$else$"us-letter"$endif$,
  margin: $if(margin)$($for(margin/pairs)$$margin.key$: $margin.value$,$endfor$)$else$(x: 1.25in, y: 1.25in)$endif$,
  numbering: $if(page-numbering)$"$page-numbering$"$else$none$endif$,
  columns: $if(columns)$$columns$$else$1$endif$,
)
$if(logo)$
#set page(background: align($logo.location$, box(inset: $logo.inset$, image("$logo.path$", width: $logo.width$$if(logo.alt)$, alt: "$logo.alt$"$endif$))))
$endif$
