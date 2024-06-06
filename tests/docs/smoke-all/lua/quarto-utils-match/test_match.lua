function Div(div)
  assert(quarto.utils.match("Div")(div) == div)
  assert(quarto.utils.match("Div/[1]")(div) == div.content[1])
  assert(quarto.utils.match("Div/[1]/Para")(div) == div.content[1])
  assert(quarto.utils.match("Div/[1]/Para/[1]")(div) == div.content[1].content[1])
  assert(quarto.utils.match("[1]/[1]")(div) == div.content[1].content[1])
  assert(not quarto.utils.match("Para/[1]/[1]")(div))

  local lst = quarto.utils.match("{Div}/[1]/{Para}/[1]/{Str}")(div)
  assert(lst[1] == div)
  assert(lst[1].t == "Div")
  assert(lst[2] == div.content[1])
  assert(lst[2].t == "Para")
  assert(lst[3] == div.content[1].content[1])
  assert(lst[3].t == "Str")
  local para = lst[2]
  
  assert(quarto.utils.match(function(node) return node.content[1].content[1] end)(div) == div.content[1].content[1])
  assert(quarto.utils.match("Div", "[1]")(div) == div.content[1])
  assert(quarto.utils.match("Div", "[1]", "Para")(div) == div.content[1])
  assert(quarto.utils.match("Div", "[1]", "Para", "[1]")(div) == div.content[1].content[1])
  assert(quarto.utils.match("[1]", "[1]")(div) == div.content[1].content[1])

  local img = quarto.utils.match("Div/:child/Para/:child/Image")(div)
  assert(img.t == "Image")
  assert(quarto.utils.match(":descendant/Image")(div) == img) -- this one is redundant with filters, but it's a good test
  assert(quarto.utils.match("Div/:descendant/Image")(div) == img) -- this is not so convenient with filters


  lst = quarto.utils.match("Div/:child/{Para}/:child/{Image}")(div)
  assert(lst[1] == para)
  assert(lst[2] == img)

end