-- latex.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to Typst

function typst_function_call(name, params)
  local result = pandoc.Blocks({})
  result:insert(pandoc.RawInline("typst", "#" .. name .. "("))
  local function add(v)
    if type(v) == "userdata" or type(v) == "table" then
      result:extend(quarto.utils.as_blocks(v) or {})
    else
      result:extend(quarto.utils.as_blocks({pandoc.utils.stringify(v)}) or {})
    end
  end
  -- needs to be array of pairs because order matters for typst
  for i, pair in ipairs(params) do
    local k = pair[1]
    local v = pair[2]
    if v ~= nil then
      result:insert(pandoc.RawInline("typst", k .. ": "))
      add(v)
      result:insert(pandoc.RawInline("typst", ", "))
    else
      add(k)
    end
  end
  result:insert(pandoc.RawInline("typst", ")"))
  return pandoc.Div(result)
end

function as_typst_content(content)
  local result = pandoc.Blocks({})
  result:insert(pandoc.RawInline("typst", "[\n"))
  result:extend(quarto.utils.as_blocks(content) or {})
  result:insert(pandoc.RawInline("typst", "]\n"))
  return result
end

function render_typst()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  local number_depth

  return {
    {
      Meta = function(m)
        m["toc-depth"] = PANDOC_WRITER_OPTIONS["toc_depth"]
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
          params:insert({"numbering", "none"})
        end
        if el.classes:includes("unlisted") then
          params:insert({"outlined", false})
        end
        params:insert({as_typst_content(el.content)})
        return typst_function_call("heading", params)
      end,
    }
  }
end

function render_typst_fixups()
  if not _quarto.format.isTypstOutput() then
    return {}
  end
  local function is_ratio_or_relative(value)
    if value == nil then
      return nil
    end
    if value:find("%%") then
      return true
    end
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
    Div = function(div)
      local cod = quarto.utils.match(".cell/:child/.cell-output-display")(div)
      if cod then
          div.classes:extend({'quarto-scaffold'})
          cod.classes:extend({'quarto-scaffold'})
      end
      return div
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