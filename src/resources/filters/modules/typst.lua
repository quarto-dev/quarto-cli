-- typst.lua
-- Copyright (C) 2024 Posit Software, PBC

-- helpers for working with typst in filters
-- this module is exposed as quarto.format.typst

local function _main()
  local function typst_function_call(name, params, keep_scaffold)
    local result = pandoc.Blocks({})
    result:insert(pandoc.RawInline("typst", "#" .. name .. "("))
    local function add(v)
      if type(v) == "number" then
        result:insert(pandoc.RawInline("typst", tostring(v)))
      elseif type(v) == "string" then
        result:insert(pandoc.RawInline("typst", "\"" .. v .. "\""))
      elseif type(v) == "boolean" then
        result:insert(pandoc.RawInline("typst", v and "true" or "false"))
      elseif v.t == "RawInline" or v.t == "RawBlock" then
        if v.format == "typst" then
          result:insert(v)
        else
          fail("typst function call with non-typst raw block")
        end
      elseif type(v) == "userdata" or type(v) == "table" then
        result:extend(quarto.utils.as_blocks(v) or {})
      else
        result:extend(quarto.utils.as_blocks({pandoc.utils.stringify(v)}) or {})
      end
    end
    -- params needs to be array of pairs because order matters for typst
    local n = #params
    for i, pair in ipairs(params) do
      if pandoc.utils.type(pair) == "table" then
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

    -- We emit slightly inefficient output here by not using `quarto-scaffold`.
    -- The result from this div cannot be a quarto-scaffold because some typst template
    -- functions assume they can get the element's children. pandoc.Div is converted to
    -- a #block, and those are guaranteed to have children.
    if keep_scaffold == false then
      return pandoc.Div(result, pandoc.Attr("", {"quarto-scaffold"}))
    else
      return pandoc.Div(result)
    end
  end
  
  local function as_typst_content(content, blocks_or_inlines)
    blocks_or_inlines = blocks_or_inlines or "blocks"
    if blocks_or_inlines == "blocks" then
      local result = pandoc.Blocks({})
      result:insert(pandoc.RawInline("typst", "["))
      result:extend(quarto.utils.as_blocks(content) or {})
      result:insert(pandoc.RawInline("typst", "]\n"))
      return result
    else
      local result = pandoc.Inlines({})
      result:insert(pandoc.RawInline("typst", "["))
      result:extend(quarto.utils.as_inlines(content) or {})
      result:insert(pandoc.RawInline("typst", "]"))
      return result
    end
  end

  local function as_typst_dictionary(tab)
    local entries = {}
    for k, v in _quarto.utils.table.sortedPairs(tab) do
      if type(v) == 'table' then
        v = as_typst_dictionary(v)
      end
      if k and v then
        table.insert(entries, k .. ': ' .. v)
      end
    end
    if #entries == 0 then return nil end
    return '(' .. table.concat(entries, ', ') .. ')'
  end
  
  return {
    function_call = typst_function_call,
    sortedPairs = sortedPairs,
    as_typst_content = as_typst_content,
    as_typst_dictionary = as_typst_dictionary,
    css = require("modules/typst_css")
  }
end

return _main()