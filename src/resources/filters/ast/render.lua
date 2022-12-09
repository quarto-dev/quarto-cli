-- render.lua
-- convert custom nodes to their final representation
--
-- Copyright (C) 2022 by RStudio, PBC

function mysplit(inputstr, pattern)
  local t = pandoc.List({})
  local match = string.gmatch(inputstr, pattern)
  if match == nil then
    return { inputstr }
  end
  for str in match do
    t:insert(str)
  end
  return t
end

function render_raw(raw)
  local parts = mysplit(raw.text, " ")
  local t = parts[1]
  local n = tonumber(parts[2])
  local handler = _quarto.ast.resolve_handler(t)
  if handler == nil then
    error("Internal Error: handler not found for custom node " .. t)
    crash_with_stack_trace()
  end
  local customNode = _quarto.ast.custom_tbl_to_node[n]
  return handler.render(customNode)
end

function renderExtendedNodes()
  if string.find(FORMAT, ".lua$") then
    return {} -- don't render in custom writers, so we can handle them in the custom writer code.
  end

  return {
    Plain = function(plain)
      if #plain.content == 1 and plain.content[1].t == "RawInline" and plain.content[1].format == "QUARTO_custom" then
        return render_raw(plain.content[1])
      end
    end,
    RawInline = function(raw)
      if raw.format == "QUARTO_custom" then
        return render_raw(raw)
      end
    end,
  }
end