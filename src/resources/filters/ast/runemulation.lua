-- runemulation.lua
-- run filters in pandoc emulation mode
--
-- Copyright (C) 2022 by RStudio, PBC

local function run_emulated_filter_chain(doc, filters, afterFilterPass)
  init_trace(doc)
  if tisarray(filters) then
    for i, v in ipairs(filters) do
      local function callback()
        doc = run_emulated_filter(doc, v, true)
      end
      if v.scriptFile then
        _quarto.withScriptFile(v.scriptFile, callback)
      else
        callback()
      end
      if afterFilterPass then
        afterFilterPass()
      end
    end
  elseif type(filters) == "table" then
    doc = run_emulated_filter(doc, filters, true)
    if afterFilterPass then
      afterFilterPass()
    end
  else
    error("Internal Error: run_emulated_filter_chain expected a table or array instead of " .. type(filters))
    crash_with_stack_trace()
  end
  end_trace()
  return doc
end

local function emulate_pandoc_filter(filters, afterFilterPass)
  return {
    traverse = 'topdown',
    Pandoc = function(doc)
      local result
      -- local profiling = true
      if profiling then
        local profiler = require('profiler')
        profiler.start()
        -- doc = to_emulated(doc)
        doc = run_emulated_filter_chain(doc, filters, afterFilterPass)
        -- doc = from_emulated(doc)

        -- the installation happens in main.lua ahead of loaders
        -- restore_pandoc_overrides(overrides_state)

        -- this call is now a real pandoc.Pandoc call
        profiler.stop()

        profiler.report("profiler.txt")
        crash_with_stack_trace() -- run a single file for now.
      end
      return run_emulated_filter_chain(doc, filters, afterFilterPass), false
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

  table.insert(pandocFilterList, emulate_pandoc_filter(specTable.filters, specTable.afterFilterPass))
  if specTable.post then
    for _, v in ipairs(specTable.post) do
      table.insert(pandocFilterList, v)
    end
  end

  return pandocFilterList
end