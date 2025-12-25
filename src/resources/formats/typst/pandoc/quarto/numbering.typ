// Simple numbering for non-book documents
#let quarto-equation-numbering = "(1)"
#let quarto-callout-numbering = "1"
#let quarto-subfloat-numbering(n-super, subfloat-idx) = {
  numbering("1a", n-super, subfloat-idx)
}
#let quarto-thmbox-args = (:)
