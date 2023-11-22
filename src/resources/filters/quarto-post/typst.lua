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
  local function is_ratio_or_relative(value)
    if value == nil then
      return nil
    end
    if value:find("%%") then
      return true
    end
  end
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  return {
    traverse = "topdown",
    Image = function(image)
      -- if the width or height are "ratio" or "relative", in typst parlance,
      -- then we currently need to hide it from Pandoc 3.1.9 until
      -- https://github.com/jgm/pandoc/issues/9104 is properly fixed
      if is_ratio_or_relative(image.attributes["width"]) or is_ratio_or_relative(image.attributes["height"]) then
        local width = image.attributes["width"]
        local height = image.attributes["height"]
        image.attributes["width"] = nil
        image.attributes["height"] = nil
        local attr_str = ""
        if width ~= nil then
          attr_str = attr_str .. "width: " .. width .. ","
        end
        if height ~= nil then
          attr_str = attr_str .. "height: " .. height .. ","
        end
        local escaped_src = image.src:gsub("\\", "\\\\"):gsub("\"", "\\\"")
        return pandoc.RawInline("typst", "#box(" .. attr_str .. "image(\"" .. escaped_src .. "\"))")
      end
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
    Cite = function(cite)
      if PANDOC_VERSION <= pandoc.types.Version('3.1.9') then
        -- Patch for https://github.com/quarto-dev/quarto-cli/issues/7586
        -- TODO: Remove when Pandoc > 3.1.9 is used https://github.com/jgm/pandoc/issues/9188
        if PANDOC_WRITER_OPTIONS.extensions:includes("citations") then
          citations = pandoc.List()
          for _, citation in pairs(cite.citations) do
            citations:insert(pandoc.RawInline('typst', "#cite(<" .. citation.id .. ">)"))
          end
          return citations
        end
      end
    end
  }
end