-- render.lua
-- convert custom nodes to their final representation
--
-- Copyright (C) 2022 by RStudio, PBC

function render_raw(raw)
  local parts = split(raw.text)
  local t = parts[1]
  local n = tonumber(parts[2])
  local handler = _quarto.ast.resolve_handler(t)
  if handler == nil then
    fatal("Internal Error: handler not found for custom node " .. t)
  end
  local customNode = _quarto.ast.custom_node_data[n]
  return handler.render(customNode)
end

function render_extended_nodes()
  if string.find(FORMAT, ".lua$") then
    return {} -- don't render in custom writers, so we can handle them in the custom writer code.
  end

  local function has_custom_nodes(node)
    local has_custom_nodes = false
    _quarto.ast.walk(node, {
      Custom = function()
        has_custom_nodes = true
      end
    })
    return has_custom_nodes
  end

  local filter

  local function render_custom(node)
    local function postprocess_render(render_result)
      -- we need to recurse in case custom nodes render to other custom nodes
      if is_custom_node(render_result) then
        -- recurse directly
        return render_custom(render_result)
      elseif has_custom_nodes(render_result) then
        -- recurse via the filter
        return _quarto.ast.walk(render_result, filter)
      else
        return render_result
      end
    end
    if type(node) == "userdata" then
      node = _quarto.ast.resolve_custom_data(node)
    end

    local handler = _quarto.ast.resolve_handler(node.t)
    if handler == nil then
      fatal("Internal Error: handler not found for custom node " .. node.t)
    end
    if handler.renderers then
      for _, renderer in ipairs(handler.renderers) do
        if renderer.condition(node) then
          return scaffold(postprocess_render(scaffold(renderer.render(node))))
        end
      end
      fatal("Internal Error: renderers table was exhausted without a match for custom node " .. node.t)
    elseif handler.render ~= nil then
      return scaffold(postprocess_render(scaffold(renderer.render(node))))
    else
      fatal("Internal Error: handler for custom node " .. node.t .. " does not have a render function or renderers table")
    end
  end

  filter = {
    Custom = render_custom
  }
  return filter
end