-- runemulation.lua
-- run filters in pandoc emulation mode
--
-- Copyright (C) 2022 by RStudio, PBC

local function run_emulated_filter_chain(doc, filters)
  if tisarray(filters) then
    for _, v in ipairs(filters) do
      local function callback()
        doc = run_emulated_filter(doc, v)
      end
      if v.scriptFile then
        _quarto.withScriptFile(v.scriptFile, callback)
      else
        callback()
      end
    end
  elseif type(filters) == "table" then
    doc = run_emulated_filter(doc, filters)
  else
    error("Internal Error: run_emulated_filter_chain expected a table or array instead of " .. type(filters))
    crash_with_stack_trace()
  end
  return doc
end

local function emulate_pandoc_filter(filters)
  return {
    traverse = 'topdown',
    Pandoc = function(doc)
      local result
      -- local profiling = true
      if profiling then
        local profiler = require('profiler')
        profiler.start()
        -- doc = to_emulated(doc)
        doc = run_emulated_filter_chain(doc, filters)
        -- doc = from_emulated(doc)

        -- the installation happens in main.lua ahead of loaders
        -- restore_pandoc_overrides(overrides_state)

        -- this call is now a real pandoc.Pandoc call
        profiler.stop()

        profiler.report("profiler.txt")
        crash_with_stack_trace() -- run a single file for now.
      end
      return run_emulated_filter_chain(doc, filters), false
    end
  }
end

function run_as_extended_ast(specTable)
  local pandocFilterList = {}
  if specTable.pre then
    for _, v in ipairs(specTable.pre) do
      table.insert(pandocFilterList, v)
    end
  end

  table.insert(pandocFilterList, emulate_pandoc_filter(specTable.filters))
  if specTable.post then
    for _, v in ipairs(specTable.post) do
      table.insert(pandocFilterList, v)
    end
  end

  return pandocFilterList
end