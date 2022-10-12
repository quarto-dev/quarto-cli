function Div(el)
  if el.attr.classes:includes("example") then
    quarto.log.output("Example div was filtered")
  end
end