function Meta(meta)
  if meta["trace_1"] ~= nil then
    trace_1 = meta["trace_1"]
  end
  if meta["trace_2"] ~= nil then
    trace_2 = meta["trace_2"]
  end
end

function Pandoc(doc)
  local function set_trace(id, name)
    local f = io.open(name, "r")
    if f == nil then
      io.stderr:write("Error: Could not open trace file: " .. name .. "\n")

    else
      local data = f:read("*all")
      f:close()
      doc.blocks:insert(pandoc.RawBlock("html", "<script type='base64-data' id='" .. id .. "_data'>" .. quarto.base64.encode(data) .. "</script>"))
      doc.blocks:insert(pandoc.RawBlock("html", "<script type='base64-data' id='" .. id .. "_name'>" .. quarto.base64.encode(name) .. "</script>"))
    end
  end
  if trace_1 ~= nil then
    set_trace("trace_1", pandoc.utils.stringify(trace_1))
  end
  if trace_2 ~= nil then
    set_trace("trace_2", pandoc.utils.stringify(trace_2))
  end
  return doc
end