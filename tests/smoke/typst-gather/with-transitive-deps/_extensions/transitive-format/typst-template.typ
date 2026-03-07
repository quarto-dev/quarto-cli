// Template that imports a local package which has transitive deps
#import "@local/dep-pkg:0.1.0": greet

#let project(title: "", body) = {
  set document(title: title)
  greet()
  body
}
