// Local package that transitively depends on a preview package
#import "@preview/example:0.1.0": add
#let greet() = "Hello! 1+2=" + str(add(1, 2))
