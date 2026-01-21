// Test template that imports a preview package
#import "@preview/example:0.1.0": *

#let project(title: "", body) = {
  set document(title: title)
  body
}
