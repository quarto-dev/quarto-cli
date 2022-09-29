local function do_it(doc, filters)
  if tisarray(filters) then
    for _, v in ipairs(filters) do
      local function callback()
        local newDoc = doc:walk(v)
        if newDoc ~= nil then
          doc = newDoc
        end
      end
      if v.scriptFile then
        _quarto.withScriptFile(v.scriptFile, callback)
      else
        callback()
      end
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

local function emulate_pandoc_filter(filters, unextended)
  local walk_block = pandoc.walk_block
  local walk_inline = pandoc.walk_inline
  local write = pandoc.write
  local Inlines = pandoc.Inlines
  local Blocks = pandoc.Blocks
  local pandoc_inlines_mtbl = getmetatable(pandoc.Inlines({}))
  local pandoc_blocks_mtbl = getmetatable(pandoc.Blocks({}))
  local utils = pandoc.utils
  local mediabag = pandoc.mediabag

  local our_utils = {
    blocks_to_inlines = function(lst)
      return to_emulated(utils.blocks_to_inlines(from_emulated(lst)))
    end,
    citeproc = function(lst)
      return to_emulated(utils.citeproc(from_emulated(doc)))
    end,
    make_sections = function(number_sections, base_level, blocks)
      return to_emulated(utils.make_sections(number_sections, base_level, from_emulated(blocks)))
    end,
    from_simple_table = function(v)
      return to_emulated(utils.from_simple_table(from_emulated(v)))
    end,
    to_simple_table = function(v)
      return to_emulated(utils.to_simple_table(from_emulated(v)))
    end,
    references = function(doc)
      return utils.references(from_emulated(doc))
    end,
    run_json_filter = function(doc, command, arguments)
      return to_emulated(utils.run_json_filter(from_emulated(doc), command, arguments))
    end,
    stringify = function(v)
      return utils.stringify(from_emulated(v))
    end,
    type = function(v)
      if v.is_emulated then
        if v.t == "Inlines" then return v.t end
        if v.t == "Blocks" then return v.t end
        if is_block[v.t] then return "Block" end
        if is_inline[v.t] then return "Inline" end
      else
        return utils.type(v)
      end
    end
  }
  setmetatable(our_utils, {
    __index = utils
  })

  local our_mediabag = {
    fill = function(doc)
      return to_emulated(mediabag.fill(from_emulated(doc)))
    end
  }

  setmetatable(our_mediabag, {
    __index = mediabag,
  })
  
  local inlines_mtbl = {
    __index = function(tbl, key)
      if key == "t" then return "Inlines" end
      if key == "walk" then return emulate_pandoc_walk end
      if key == "is_emulated" then return true end
      return pandoc_inlines_mtbl.__index[key] -- pandoc_inlines_mtbl.__index is a _table_ (!)
    end,
    __concat = emulated_node_concat,
    __eq = emulated_node_eq,
  }

  setmetatable(inlines_mtbl, {
    __index = function(_, key)
      return pandoc_inlines_mtbl[key]
    end,
  })

  local blocks_mtbl = {
    __index = function(tbl, key)
      if key == "t" then return "Blocks" end
      if key == "walk" then return emulate_pandoc_walk end
      if key == "is_emulated" then return true end
      return pandoc_blocks_mtbl.__index[key] -- pandoc_blocks_mtbl.__index is a _table_ (!)
    end,    
    __concat = emulated_node_concat,
    __eq = emulated_node_eq,
  }

  setmetatable(blocks_mtbl, {
    __index = function(_, key)
      return pandoc_blocks_mtbl[key]
    end,
  })

  local ast_constructors = {}
  quarto.ast._true_pandoc = ast_constructors
  quarto.ast._true_pandoc.Blocks = Blocks
  quarto.ast._true_pandoc.Inlines = Inlines

  function install_pandoc_overrides()
    pandoc.utils = our_utils
    pandoc.mediabag = our_mediabag
    pandoc.TableBody = function(body, head, row_head_columns, attr)
      return {
        body = body,
        head = head,
        row_head_columns = row_head_columns or 1,
        attr = attr or pandoc.Attr(),
        t = "TableBody"
      }
    end
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
        local native = from_emulated(el)
        return write(native, format)
      end
      return write(el, format)
    end
    for k, _ in pairs(pandoc_constructors_args) do
      ast_constructors[k] = pandoc[k]
      pandoc[k] = pandoc_emulated_node_factory(k)
    end
    pandoc.Inlines = function(value)
      local result = {}
      setmetatable(result, inlines_mtbl)

      if value == nil then
        return result
      elseif value.t == "Inlines" or value.t == "List" or (tisarray(value) and not value.is_emulated) then
        result:extend(value)
        return result
      elseif value.t == "Blocks" then
        print("Type error: can't initialize Inlines with Blocks")
        crash_with_stack_trace()
      else
        result:insert(value)
        return result
      end
    end
    pandoc.Blocks = function(value)
      local result = {}
      setmetatable(result, blocks_mtbl)

      if value == nil then
        return result
      elseif value.t == "Blocks" or value.t == "List" or (tisarray(value) and not value.is_emulated) then
        result:extend(value)
        return result
      elseif value.t == "Inlines" then
        print("Type error: can't initialize Blocks with Inlines")
        crash_with_stack_trace()
      else
        result:insert(value)
        return result
      end

    end
  end

  function restore_pandoc_overrides()
    pandoc.utils = utils
    pandoc.mediabag = mediabag
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
        doc = to_emulated(doc)
      end
      doc = do_it(doc, filters)

      if not unextended then
        -- quarto.utils.dump(doc)
        doc = from_emulated(doc)
        -- print(doc)
        if doc == nil then
          error("Internal Error: emulate_pandoc_filter received nil from from_emulated")
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
    for _, v in ipairs(specTable.pre) do
      table.insert(pandocFilterList, v)
    end
  end

  table.insert(pandocFilterList, emulate_pandoc_filter(specTable.filters, unextended))
  if specTable.post then
    for _, v in ipairs(specTable.post) do
      table.insert(pandocFilterList, v)
    end
  end

  return pandocFilterList
end