-- latex.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to Typst


function render_typst()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  return {
    Div = function(div)
      if div.classes:includes("block") then
        div.classes = div.classes:filter(function(c) return c ~= "block" end)

        local preamble = pandoc.Blocks({})
        local postamble = pandoc.Blocks({})
        preamble:insert(pandoc.RawBlock("typst", "#block("))
        for k, v in pairs(div.attributes) do
          -- FIXME: proper escaping of k and v
          preamble:insert(pandoc.RawBlock("typst", k .. ":" .. v .. ",\n"))
        end
        preamble:insert(pandoc.RawBlock("typst", "[\n"))
        postamble:insert(pandoc.RawBlock("typst", "])\n\n"))

        local result = pandoc.Blocks({})
        result:extend(preamble)
        result:extend(div.content)
        result:extend(postamble)
        return result
      end
    end
  }
end

function render_typst_fixups()
  return {
    Para = function(para)
      return para:walk({
        Image = function(image)
          if image.attributes["width"] == nil and image.attributes["height"] == nil then
            return nil
          end
          return pandoc.Inlines({
            pandoc.RawInline("typst", "#box(["),
            image,
            pandoc.RawInline("typst", "])"),
          })
        end
      })
    end
  }
end