-- runemulation.lua
-- run filters in pandoc emulation mode
--
-- Copyright (C) 2022 by RStudio, PBC

local profiler = require('profiler')

-- locate or create the quarto vault,
-- inserting the just-added nodes if needed, and mutating doc
local ensure_vault = function(doc)
  local vault = _quarto.ast.vault.locate(doc)
 
  -- create if missing
  if vault == nil then
    vault = pandoc.Div({}, pandoc.Attr(_quarto.ast.vault._uuid, {"hidden"}, {}))
    doc.blocks:insert(vault)
  end

  for k, v in pairs(_quarto.ast.vault._added) do
    local div = pandoc.Div(quarto.utils.as_blocks(v), pandoc.Attr(k, {}, {}))
    vault.content:insert(div)
  end
  vault.content = _quarto.ast.walk(vault.content, {
    Div = function(div)
      if _quarto.ast.vault._removed[div.identifier] then
        return {}
      end
    end
  }) or pandoc.Blocks({}) -- to satisfy the Lua analyzer

  _quarto.ast.vault._added = {}
  _quarto.ast.vault._removed = {}
end

local function remove_vault(doc)
  -- attempt a fast lookup first
  if #doc.blocks > 0 and doc.blocks[#doc.blocks].identifier == _quarto.ast.vault._uuid then
    doc.blocks:remove(#doc.blocks)
  else
    -- otherwise search for it
    for i, block in ipairs(doc.blocks) do
      if block.identifier == _quarto.ast.vault._uuid then
        doc.blocks:remove(i)
        break
      end
    end
  end
end

local function run_emulated_filter_chain(doc, filters, afterFilterPass, profiling)
  init_trace(doc)
  for i, v in ipairs(filters) do
    local function callback()
      if v.flags then
        if type(v.flags) ~= "table" then
          -- luacov: disable
          fatal("filter " .. v.name .. " has invalid flags")
          -- luacov: enable
        end
        local can_skip = true
        for _, index in ipairs(v.flags) do
          if flags[index] == true then
            can_skip = false
          end
        end
        if can_skip then
          return
        end
      end

      -- We don't seem to need coverage for profiling
      -- luacov: disable
      if profiling then
        profiler.category = v.name
      end
      -- luacov: enable

      if v.print_ast then
        print(pandoc.write(doc, "native"))
      else
        _quarto.ast._current_doc = doc
        doc = run_emulated_filter(doc, v.filter)
        ensure_vault(doc)

        add_trace(doc, v.name)

        -- luacov: disable
        if profiling then
          profiler.category = ""
        end
        if os.getenv("QUARTO_FLUSH_TRACE") then
          end_trace()
        end
        -- luacov: enable
      end
    end
    if v.filter and v.filter.scriptFile then
      _quarto.withScriptFile(v.filter.scriptFile, callback)
    else
      callback()
    end
    if afterFilterPass then
      afterFilterPass()
    end
  end
  end_trace()
  remove_vault(doc)
  return doc
end

local function emulate_pandoc_filter(filters, afterFilterPass)
  local cached_paths
  local profiler

  -- luacov: disable
  local function get_paths(tmpdir)
    if cached_paths then
      return cached_paths
    end
    os.execute("quarto --paths > " .. tmpdir .. "paths.txt")
    local paths_file = io.open(tmpdir .. "paths.txt", "r")
    if paths_file == nil then
      error("couldn't open paths file")
    end
    cached_paths = paths_file:read("l")
    paths_file:close()
    return cached_paths
  end
  -- luacov: enable
  
  return {
    traverse = 'topdown',
    Pandoc = function(doc)
      local profiling = option("profiler", false)
      if not profiling then
        return run_emulated_filter_chain(doc, filters, afterFilterPass), false
      end
      -- luacov: disable
      if profiler == nil then
        profiler = require('profiler')
      end
      pandoc.system.with_temporary_directory("temp", function(tmpdir)
        profiler.start(tmpdir .. "/prof.txt")
        doc = run_emulated_filter_chain(doc, filters, afterFilterPass, profiling)
        profiler.stop()
        -- os.execute("cp " .. tmpdir .. "/prof.txt /tmp/prof.out")
        local ts_source = get_paths(tmpdir) .. "/../../../tools/profiler/convert-to-perfetto.ts"
        os.execute("quarto run " .. ts_source .. " " .. tmpdir .. "/prof.txt > " .. profiling)
        return nil
      end)
      return doc, false
      -- luacov: enable
    end
  }
end

function run_as_extended_ast(specTable)

  local function coalesce_filters(filterList)
    local finalResult = {}
  
    for i, v in ipairs(filterList) do
      if v.filter ~= nil or v.print_ast then
        -- v.filter._filter_name = v.name
        table.insert(finalResult, v)
      elseif v.filters ~= nil then
        for j, innerV in pairs(v.filters) do
          innerV._filter_name = string.format("%s-%s", v.name, j)
          table.insert(finalResult, {
            filter = innerV,
            name = innerV._filter_name,
            flags = v.flags
          })
        end
      else
        -- luacov: disable
        warn("filter " .. v.name .. " didn't declare filter or filters.")
        -- luacov: enable
      end
    end
  
    return finalResult
  end

  specTable.filters = coalesce_filters(specTable.filters)

  local pandocFilterList = {}
  if specTable.pre then
    for _, v in ipairs(specTable.pre) do
      table.insert(pandocFilterList, v)
    end
  end

  table.insert(pandocFilterList, emulate_pandoc_filter(
    specTable.filters,
    specTable.afterFilterPass
  ))

  if specTable.post then
    for _, v in ipairs(specTable.post) do
      table.insert(pandocFilterList, v)
    end
  end

  return pandocFilterList
end