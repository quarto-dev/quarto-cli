-- latex.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to Typst

-- FIXME Ideally this would go directly on init.lua, but
-- the module path set up doesn't appear to be working there.
 
local typst = require("modules/typst")
_quarto.format.typst = typst

function render_typst()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  local number_depth

  return {
    {
      Meta = function(m)
        m["toc-depth"] = PANDOC_WRITER_OPTIONS["toc_depth"]
        m["toc-indent"] = option("toc-indent")
        if m["number-depth"] then
          number_depth = tonumber(pandoc.utils.stringify(m["number-depth"]))
          print(number_depth)
        end
        return m
      end
    },
    {
      FloatRefTarget = function(float)
        if float.content.t == "Table" then
          -- this needs the fix from https://github.com/jgm/pandoc/pulls/9778
          float.content.classes:insert("typst-no-figure")
        else
          float.content = _quarto.ast.walk(float.content, {
            Table = function(tbl)
              tbl.classes:insert("typst-no-figure")
              return tbl
            end
          })
        end
        return float
      end,
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
      end,
      Header = function(el)
        if number_depth and el.level > number_depth then
          el.classes:insert("unnumbered")
        end
        if not el.classes:includes("unnumbered") and not el.classes:includes("unlisted") then
          return nil
        end
        local params = pandoc.List({
          {"level", el.level},
        })
        if el.classes:includes("unnumbered") then
          params:insert({"numbering", pandoc.RawInline("typst", "none")})
        end
        if el.classes:includes("unlisted") then
          params:insert({"outlined", false})
        end
        params:insert({_quarto.format.typst.as_typst_content(el.content)})
        return _quarto.format.typst.function_call("heading", params)
      end,
    }
  }
end

function render_typst_fixups()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  return {
    traverse = "topdown",
    Image = function(image)
      image = _quarto.modules.mediabag.resolve_image_from_url(image) or image
      -- REMINDME 2024-09-01
      -- work around until https://github.com/jgm/pandoc/issues/9945 is fixed
      local height_as_number = tonumber(image.attributes["height"])
      local width_as_number = tonumber(image.attributes["width"])
      if image.attributes["height"] ~= nil and type(height_as_number) == "number" then
        image.attributes["height"] = tostring(image.attributes["height"] / PANDOC_WRITER_OPTIONS.dpi) .. "in"
      end
      if image.attributes["width"] ~= nil and type(width_as_number) == "number" then
        image.attributes["width"] = tostring(image.attributes["width"] / PANDOC_WRITER_OPTIONS.dpi) .. "in"
      end
      return image
    end,
    Div = function(div)
      -- is the div a .cell which contains .cell-output-display as child or grandchild?
      local cod = quarto.utils.match(".cell/:child/Div/:child/.cell-output-display")(div)
        or
        quarto.utils.match(".cell/:child/.cell-output-display")(div)
      if cod then
          div.classes:extend({'quarto-scaffold'})
          cod.classes:extend({'quarto-scaffold'})
      end
      return div
    end,
    Table = function(tbl)
      -- https://github.com/quarto-dev/quarto-cli/issues/10438
      tbl.classes:insert("typst:no-figure")
      return tbl
    end,
    Para = function(para)
      if #para.content ~= 1 then
        return nil
      end
      local img = quarto.utils.match("[1]/Image")(para)
      if not img then
        return nil
      end
      local align = img.attributes["fig-align"]
      if align == nil then
        return nil
      end

      img.attributes["fig-align"] = nil
      return pandoc.Inlines({
        pandoc.RawInline("typst", "#align(" .. align .. ")["),
        img,
        pandoc.RawInline("typst", "]"),
      })
    end,
  }
end
