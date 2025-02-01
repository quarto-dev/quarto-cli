function Div(div)
  if div.identifier == "find-me" then
    return quarto.format.typst.function_call("add", {3, 4})
  end
end