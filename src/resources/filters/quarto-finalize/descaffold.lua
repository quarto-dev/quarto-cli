-- descaffold.lua
-- Copyright (C) 2023 Posit Software, PBC

function descaffold() 
  return {
    Span = function(el) 
      if el.classes:includes("quarto-scaffold") then
        return el.content
      end
    end,
    Div = function(el) 
      if el.classes:includes("quarto-scaffold") then
        return el.content
      end
    end
  }
end

function make_scaffold(ctor, node)
  return ctor(node or {}, pandoc.Attr("", {"quarto-scaffold", "hidden"}, {}))
end
