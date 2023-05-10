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
    table.insert(data, {
      state = filter_name,
      doc = quarto.json.decode(pandoc.write(doc, "json"))
    })
  end

  function end_trace()
    local file = io.open("quarto-filter-trace.json", "w")
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