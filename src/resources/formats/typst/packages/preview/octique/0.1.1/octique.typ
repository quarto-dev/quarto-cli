#import "impl/octique.typ": _octique-svg, _octique-image

// Returns an image for the given name.
#let octique(name, color: rgb("#000000"), width: 1em, height: 1em) = _octique-image(name, color: color, width: width, height: width)

// Returns a boxed image for the given name.
#let octique-inline(name, color: rgb("#000000"), width: 1em, height: 1em, baseline: 25%) = {
  box(baseline: baseline, octique(name, color: color, width: width, height: height))
}

// Returns an SVG text for the given name.
#let octique-svg(name) = _octique-svg(name)
