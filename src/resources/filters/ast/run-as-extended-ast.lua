function do_it(doc, filters)
  if tisarray(filters) then
    -- print("This is the old doc")
    -- quarto.utils.dump(doc)

    for i, v in pairs(filters) do
      -- print("Will run filter " .. tostring(v._filter_name or i) .. ": ")
      -- quarto.utils.dump(doc, true)
      local newDoc = doc:walk(v)
      if newDoc ~= nil then
        doc = newDoc
      end
      -- print("This is the new doc:")
      -- quarto.utils.dump(doc)
      -- print("----")
    end
  elseif type(filters) == "table" then
    local newDoc = doc:walk(filters)
    if newDoc ~= nil then
      doc = newDoc
    end
  else
    error("Internal Error: do_it expected a table or array instead of " .. type(filters))
    crash_with_stack_trace()
  end
  return doc
end


function emulate_pandoc_filter(filters, unextended)
  local walk_block = pandoc.walk_block
  local walk_inline = pandoc.walk_inline
  local write = pandoc.write
  local Inlines = pandoc.Inlines
  local Blocks = pandoc.Blocks
  local inlines_mtbl = getmetatable(pandoc.Inlines({}))
  local blocks_mtbl = getmetatable(pandoc.Blocks({}))
  
  local ast_constructors = {}
  quarto.ast._true_pandoc = ast_constructors

  function install_pandoc_overrides()
    pandoc.walk_block = function(el, filter)
      if el.is_emulated then
        return el:walk(filter)
      end
      return walk_block(el, filter)
    end
    pandoc.walk_inline = function(el, filter)
      if el.is_emulated then
        return el:walk(filter)
      end
      return walk_inline(el, filter)
    end
    pandoc.write = function(el, format)
      if el.is_emulated then
        local denormalized = denormalize(el)
        return write(denormalized, format)
      end
      return write(el, format)
    end
    for k, _ in pairs(pandoc_constructors_args) do
      ast_constructors[k] = pandoc[k]
      pandoc[k] = pandoc_emulated_node_factory(k)
    end
    pandoc.Inlines = function(value)
      if tisarray(value) and not value.is_emulated then
        local result = tmap(value, function(v) 
          return v 
        end)
        setmetatable(result, inlines_mtbl)
        return result
      else
        local result = { value }
        setmetatable(result, inlines_mtbl)
        return result
      end
    end
    pandoc.Blocks = function(value)      
      if tisarray(value) and not value.is_emulated then
        local result = tmap(value, function(v) return v end)
        setmetatable(result, blocks_mtbl)
        return result
      else
        local result = { value }
        setmetatable(result, blocks_mtbl)
        return result
      end
    end
  end

  function restore_pandoc_overrides()
    pandoc.walk_block = walk_block
    pandoc.walk_inline = walk_inline
    pandoc.write = write
    for k, _ in pairs(pandoc_constructors_args) do
      pandoc[k] = ast_constructors[k]
    end
    pandoc.Inlines = Inlines
    pandoc.Blocks = Blocks
  end

  return {
    traverse = 'topdown',
    Pandoc = function(doc)

      install_pandoc_overrides()

      if not unextended then
        doc = normalize(doc)
      end
      doc = do_it(doc, filters)

      if not unextended then
        -- quarto.utils.dump(doc)
        doc = denormalize(doc)
        -- print(doc)
        if doc == nil then
          error("Internal Error: emulate_pandoc_filter received nil from denormalize")
          crash_with_stack_trace()
          return pandoc.Pandoc({}, {}) -- a lie to appease the type system
        end
      end

      restore_pandoc_overrides()

      return pandoc.Pandoc(doc.blocks, doc.meta), false
    end
  }
end

function run_as_extended_ast(specTable, unextended)
  local pandocFilterList = {}
  if specTable.pre then
    for _, v in pairs(specTable.pre) do
      table.insert(pandocFilterList, v)
    end
  end

  table.insert(pandocFilterList, emulate_pandoc_filter(specTable.filters, unextended))
  if specTable.post then
    for _, v in pairs(specTable.post) do
      table.insert(pandocFilterList, v)
    end
  end

  return pandocFilterList
end