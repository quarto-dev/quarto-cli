// Test template that imports a local package
#import "@local/my-local-pkg:0.1.0": hello

#let project(title: "", body) = {
  set document(title: title)
  hello()
  body
}
