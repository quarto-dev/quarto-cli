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
        -- This should be a number, but we must represent it as a string,
        -- as numbers are disallowed as metadata values.
        m["toc-depth"] = tostring(PANDOC_WRITER_OPTIONS["toc_depth"])
        m["toc-indent"] = option("toc-indent")
        if m["number-depth"] then
          number_depth = tonumber(pandoc.utils.stringify(m["number-depth"]))
          print(number_depth)
        end
        return m
      end
    },
    {
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

      -- Workaround for Pandoc not passing alt text to Typst image() calls
      -- See: https://github.com/jgm/pandoc/issues/XXXX (TODO: file upstream)
      local alt_text = image.attributes["alt"]
      if (alt_text == nil or alt_text == "") and #image.caption > 0 then
        alt_text = pandoc.utils.stringify(image.caption)
      end

      if alt_text and #alt_text > 0 then
        -- When returning RawInline instead of Image, Pandoc won't write mediabag
        -- entries to disk, so we must do it explicitly
        local src = image.src
        local mediabagPath = _quarto.modules.mediabag.write_mediabag_entry(src)
        if mediabagPath then
          src = mediabagPath
        end

        -- Build image() parameters
        local params = {}

        -- Source path (escape backslashes for Windows paths)
        src = src:gsub('\\', '\\\\')
        table.insert(params, '"' .. src .. '"')

        -- Alt text second (escape backslashes and quotes)
        local escaped_alt = alt_text:gsub('\\', '\\\\'):gsub('"', '\\"')
        table.insert(params, 'alt: "' .. escaped_alt .. '"')

        -- Height if present
        if image.attributes["height"] then
          table.insert(params, 'height: ' .. image.attributes["height"])
        end

        -- Width if present
        if image.attributes["width"] then
          table.insert(params, 'width: ' .. image.attributes["width"])
        end

        -- Use #box() wrapper for inline compatibility
        return pandoc.RawInline("typst", "#box(image(" .. table.concat(params, ", ") .. "))")
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
      return pandoc.Plain({
        pandoc.RawInline("typst", "#align(" .. align .. ")["),
        img,
        pandoc.RawInline("typst", "]"),
      })
    end,
  }
end
