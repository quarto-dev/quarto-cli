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
      local profiling = option("profiler", false)
      if profiling then
        pandoc.system.with_temporary_directory("temp", function(tmpdir)
          local profiler = require('profiler')
          profiler.start(tmpdir .. "prof.txt")
          doc = run_emulated_filter_chain(doc, filters, afterFilterPass)
          profiler.stop()
          os.execute("quarto --paths > " .. tmpdir .. "paths.txt")
          local paths = io.open(tmpdir .. "paths.txt", "r")
          local ts_source = paths:read("l") .. "/../../../tools/profiler/convert-to-perfetto.ts"
          paths:close()
          os.execute("quarto run " .. ts_source .. " " .. tmpdir .. "prof.txt > " .. profiling)
          return nil
        end)
        return doc, false
      else 
        return run_emulated_filter_chain(doc, filters, afterFilterPass), false
      end
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