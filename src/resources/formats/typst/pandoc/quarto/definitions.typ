// Some definitions presupposed by pandoc's typst output.
#let blockquote(body) = [
  #set text( size: 0.92em )
  #block(inset: (left: 1.5em, top: 0.2em, bottom: 0.2em))[#body]
]

#let horizontalrule = [
  #line(start: (25%,0%), end: (75%,0%))
]

#let endnote(num, contents) = [
  #stack(dir: ltr, spacing: 3pt, super[#num], contents)
]

#show terms: it => {
  it.children
    .map(child => [
      #strong[#child.term]
      #block(inset: (left: 1.5em, top: -0.4em))[#child.description]
      ])
    .join()
}

// some quarto-specific definitions

// subfloat support based on https://github.com/typst/typst/issues/246#issuecomment-1485042544
// FIXME check and fix numbering support
#let quarto_subfloat(body, caption, ref) = {
  let numbering = "(a)" // FIXME

  let figurecount = counter("quarto-" + ref) // Main float counter
  let subfigurecount = counter("quarto-sub-" + ref) // Counter linked to main counter with additional sublevel
  let subfigurecounterdisplay = counter("quarto-subcounter-" + ref) // Counter with only the last level of the previous counter, to allow for nice formatting

  let number = locate(loc => {
    let fc = figurecount.at(loc)
    let sc = subfigurecount.at(loc)

    if fc == sc.slice(0,-1) {
      subfigurecount.update(
        fc + (sc.last()+1,)
      ) // if the first levels match the main figure count, update by 1
      subfigurecounterdisplay.update((sc.last()+1,)) // Set the display counter correctly
    } else {
      subfigurecount.update( fc + (1,)) // if the first levels _don't_ match the main figure count, set to this and start at 1
      subfigurecounterdisplay.update((1,)) // Set the display counter correctly
    }
    subfigurecounterdisplay.display(numbering) // display the counter with the first figure level chopped off
  })
  
  // fixme use caption location information

  body // put in the body
  v(-.65em) // remove some whitespace that appears (inelegant I think)

  if not caption == none {
    align(center)[#number #caption] // place the caption in below the content
  }
}

#show ref: it => {
  let el = it.element
  if el == none {
    return it
  }
  link(el.location(), [
    This is a custom reference. #it.citation.supplement
  ])      
}