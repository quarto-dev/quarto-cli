-- traceexecution.lua
-- produce a json file from filter chain execution
--
-- Copyright (C) 2022 by RStudio, PBC

local data = {}

if os.getenv("QUARTO_TRACE_FILTERS") then
  function init_trace(doc)
    table.insert(data, {
      state = "__start",
      doc = quarto.json.decode(pandoc.write(doc, "json"))
    })
  end

  function add_trace(doc, filter_name)
    local function safe_json(value)
      local t = type(value)
      if t == "table" then
        local result = {}
        for k,v in pairs(value) do
          result[k] = safe_json(v)
        end
        return result
      elseif t == "userdata" then
        return nil -- skip pandoc values entirely
      else
        return value
      end
    end
    doc = _quarto.ast.walk(doc, {
      Custom = function(custom)
        local div = custom.__quarto_custom_node
        local custom_table = quarto.json.encode(safe_json(custom))
        div.attributes["__quarto_custom_table"] = custom_table
        return div
      end
    })
    if doc == nil then
      fatal("Unable to encode document as json")
    end
    table.insert(data, {
      state = filter_name,
      doc = quarto.json.decode(pandoc.write(doc, "json"))
    })
  end

  function end_trace()
    local tracefile = os.getenv("QUARTO_TRACE_FILTERS")
    if tracefile == "true" then
      tracefile = "quarto-filter-trace.json"
    end
    local file = io.open(tracefile, "w")
    if file == nil then
      fatal("Unable to open quarto-filter-trace.json for writing")
    end
    file:write(quarto.json.encode({
      data = data
    }))
    file:close()
  end
else
  function init_trace(doc)
  end
  function add_trace(doc, filter_name)
  end
  function end_trace()
  end
end