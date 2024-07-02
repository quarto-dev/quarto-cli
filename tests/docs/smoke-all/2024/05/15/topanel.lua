function Div(div)
  if not div.classes:includes("to-panel") then 
    return
  end
  local code_block = nil
  local cell_output = nil
  quarto._quarto.ast.walk(div.content, {
    CodeBlock = function(code)
      if code.classes:includes("cell-code") then
        code_block = code
      end
    end,
    Div = function(div)
      if div.classes:includes("cell-output") then
        cell_output = div
      end
    end
  })

  local rendered = quarto.Tab({ title = "Rendered", content = cell_output })
  local source = quarto.Tab({ title = "Source", code_block })
  local tabs = pandoc.List({ rendered, source })

  return quarto.Tabset({
    level = 3,
    tabs = tabs
  })
end