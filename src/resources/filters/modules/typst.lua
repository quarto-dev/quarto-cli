-- typst.lua
-- Copyright (C) 2024 Posit Software, PBC

-- helpers for working with typst in filters
-- this module is exposed as quarto.format.typst

local function _main()
  local function typst_function_call(name, params)
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
    local n = #params
    for i, pair in ipairs(params) do
      if type(pair) == "table" then
        local k = pair[1]
        local v = pair[2]
        if v ~= nil then
          result:insert(pandoc.RawInline("typst", k .. ": "))
          add(v)
        else
          add(k)
        end
      else
        add(pair)
      end
      if i < n then
        result:insert(pandoc.RawInline("typst", ", "))
      end
    end
    result:insert(pandoc.RawInline("typst", ")"))
    return pandoc.Div(result, pandoc.Attr("", {"quarto-scaffold"}))
  end
  
  local function as_typst_content(content)
    local result = pandoc.Blocks({})
    result:insert(pandoc.RawInline("typst", "[\n"))
    result:extend(quarto.utils.as_blocks(content) or {})
    result:insert(pandoc.RawInline("typst", "]\n"))
    return result
  end
  
  return {
    function_call = typst_function_call,
    as_typst_content = as_typst_content
  }
end

return _main()