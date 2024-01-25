function Div(div)
  if (div.classes:includes("cell") and div.attributes.layout ~= nil) then
    local count = 0
    quarto._quarto.ast.walk(div, {
      Div = function(div)
        if div.classes:includes("cell-output-display") then
          count = count + #div.content
        end
      end
    })
    assert(count == 2)
  end
end