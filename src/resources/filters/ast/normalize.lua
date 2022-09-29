local fancy_keys = {
  ["-is-extended-ast-"] = true,
  ["t"] = true,
  ["tag"] = true
}

function is_plain_key(k)
  return not fancy_keys[k]
end

function normalize(node)
  local doArray = function(lst)
    return tmap(lst, normalize)
  end

  local doBlocksArray = function(lst)
    -- these are emulated
    return pandoc.Blocks(tmap(lst, normalize))
  end

  local doInlinesArray = function(lst)
    -- these are emulated
    local normalized_contents = tmap(lst, normalize)
    local result = pandoc.Inlines(normalized_contents)
    return result
  end

  local doBlocksArrayArray = function(lst) 
    return tmap(lst, doBlocksArray) 
  end

  local doInlinesArrayArray = function(lst) 
    return tmap(lst, doInlinesArray) 
  end

  local baseHandler = quarto.ast.copyAsExtendedNode

  local blocksContentHandler = function(el)
    local result = baseHandler(el)
    result.content = doBlocksArray(el.content)
    return result
  end

  local inlinesContentHandler = function(el)
    local result = baseHandler(el)
    result.content = doInlinesArray(el.content)
    return result
  end

  local blocksContentArrayHandler = function(el)
    local result = baseHandler(el)
    result.content = doBlocksArrayArray(el.content)
    return result
  end

  local inlinesContentArrayHandler = function(el)
    local result = baseHandler(el)
    result.content = doInlinesArrayArray(el.content)
    return result
  end

  local normalize_table_body = function(body)
    return {
      attr = body.attr,
      body = tmap(body.body, normalize),
      head = tmap(body.head, normalize),
      row_head_columns = body.row_head_columns
    }
  end

  local typeTable = {
    Pandoc = function(doc)
      local result = baseHandler(doc)
      result.blocks = doBlocksArray(doc.blocks)
      return result
    end,

    -- Blocks
    BlockQuote = blocksContentHandler,
    BulletList = blocksContentArrayHandler,

    -- FIXME unclear what to do here from https://pandoc.org/lua-filters.html#type-definitionlist
    -- we're going to have to do it from the source: pandoc-types/src/Text/Pandoc/Definition.hs
    -- DefinitionList = function(element)
    -- end,

    CodeBlock = baseHandler,

    Div = function(div)
      -- FIXME this is also not right, should not be constructing
      -- these from scratch

      local name = div.attr.attributes["quarto-extended-ast-tag"]
      local handler = quarto.ast.resolveHandler(name)
      if handler == nil then
        -- we don't use the handler, but just check for its
        -- absence and build a standard div block in that case.
        return blocksContentHandler(div)
      else
        return baseHandler(div)
      end
    end,

    Header = inlinesContentHandler,
    LineBlock = inlinesContentArrayHandler,
    OrderedList = function(el)
      local result = baseHandler(el)
      result.content = doBlocksArrayArray(el.content)
      result.listAttributes = baseHandler(el.listAttributes)
      return result
    end,
    Para = inlinesContentHandler,
    Plain = inlinesContentHandler,
    RawBlock = baseHandler,

    -- Inlines
    Cite = function(el)
      local result = baseHandler(el)
      result.content = doInlinesArray(el.content)
      result.citations = doArray(el.citations)
      return result
    end,
    Code = baseHandler,

    Emph = inlinesContentHandler,
    Image = function(image)
      local result = baseHandler(image)
      result.caption = doInlinesArray(image.caption)
      return result
    end,
    Link = inlinesContentHandler,
    Math = baseHandler,
    Note = blocksContentHandler,
    Quoted = inlinesContentHandler,
    RawInline = baseHandler,

    SmallCaps = inlinesContentHandler,
    Span = inlinesContentHandler,
    Strikeout = inlinesContentHandler,
    Strong = inlinesContentHandler,
    Subscript = inlinesContentHandler,
    Superscript = inlinesContentHandler,
    Underline = inlinesContentHandler,

    SimpleTable = function(tbl)
      local result = baseHandler(tbl)
      result.caption = doInlinesArray(result.caption)
      result.headers = doBlocksArray(result.headers)
      result.rows = doBlocksArrayArray(result.rows)
      return result
    end,

    Table = function(tbl)
      local result = baseHandler(tbl)
      result.caption = {
        long = result.caption.long and doBlocksArray(result.caption.long),
        short = result.caption.short and doInlinesArray(result.caption.short)
      }
      result.head = normalize(result.head)
      result.bodies = tmap(result.bodies, normalize_table_body)
      result.foot = normalize(result.foot)
      return result
    end,

    ["pandoc TableBody"] = function(body)
      local result = baseHandler(body)
      result.body = tmap(result.body, normalize)
      result.head = tmap(result.head, normalize)
      return result
    end,

    ["pandoc Row"] = function(row)
      local result = baseHandler(row)
      result.cells = tmap(result.cells, normalize)
      return result
    end,

    ["pandoc Cell"] = function(cell)
      local result = baseHandler(cell)
      result.contents = tmap(result.contents, normalize)
      return result
    end,

    ["pandoc TableFoot"] = function(foot)
      local result = baseHandler(foot)
      result.rows = tmap(result.rows, normalize)      
      return result
    end,

    ["pandoc TableHead"] = function(head)
      local result = baseHandler(head)
      result.rows = tmap(result.rows, normalize)      
      return result
    end,

    Str = baseHandler,
    Space = baseHandler,
    SoftBreak = baseHandler,
    HorizontalRule = baseHandler,
    LineBreak = baseHandler,
    Null = baseHandler,

    Blocks = function(blocks)
      return doBlocksArray(blocks)
    end,

    Inlines = function(inlines)
      return doInlinesArray(inlines)
    end,

    -- others
    Citation = baseHandler,
    ListAttributes = baseHandler,
  }

  local t = node.t or pandoc.utils.type(node)
  local dispatch = typeTable[t]
  if dispatch == nil then
    print("Internal Error in normalize(): found nil dispatch for node")
    quarto.utils.dump(node, true)
    print(node)
    print(type(node))
    crash_with_stack_trace()
    return node
  else
    local result = dispatch(node)
    -- if type(result) == "table" and result["-quarto-internal-type-"] == nil then
    --   result["-quarto-internal-type-"] = t
    -- end
    return result
  end
end

function denormalize(node)
  local doArray = function(lst)
    return tmap(lst, denormalize)
  end

  local doArrayArray = function(lst)
    return tmap(lst, doArray)
  end

  -- Row = { "cells", "attr" },
  -- TableFoot = { "rows", "attr" },
  -- TableHead = { "rows", "attr" },
  -- TableBody = { "body", "head", "row_head_columns", "attr" },
  -- Cell = { "contents", "align", "row_span", "col_span", "attr" }

  local constructor_table = {
    Blocks = doArray,
    Inlines = doArray,
    ["pandoc Row"] = function(tbl)
      return quarto.ast._true_pandoc.Row(tbl.cells, tbl.attr)
    end,
    ["pandoc TableHead"] = function(tbl)
      return quarto.ast._true_pandoc.TableHead(tbl.rows, tbl.attr)
    end,
    ["pandoc TableBody"] = function(tbl)
      return quarto.ast._true_pandoc.TableBody(tbl.body, tbl.head, tbl.row_head_columns, tbl.attr)
    end,
    ["pandoc TableFoot"] = function (tbl)
      return quarto.ast._true_pandoc.TableFoot(tbl.rows, tbl.attr)
    end,
    ["pandoc Cell"] = function(tbl)
      return quarto.ast._true_pandoc.Cell(tbl.contents, tbl.align, tbl.row_span, tbl.col_span, tbl.attr)
    end
  }

  local baseHandler = function(tbl)
    local t = tbl.t -- ["-quarto-internal-type-"]
    local v = pandoc_constructors_args[t]
    if v == nil then
      return constructor_table[t](tbl)
    end
    local args = tmap(v, function(key) 
      return tbl[key] 
    end)
    if args == nil then
      print("Internal error, argsTable had no entry for " .. t)
      crash_with_stack_trace()
      return
    end
    local result = quarto.ast._true_pandoc[t](table.unpack(args))
    return result
  end

  local copy = function(tbl)
    local result = quarto.ast.copyAsExtendedNode(tbl)
    if result == nil then
      crash_with_stack_trace()
      return tbl -- a lie to appease the type system
    end
    return result
  end

  local contentHandler = function(el)
    el = copy(el)
    el.content = doArray(el.content)
    local result = baseHandler(el)
    return result
  end

  local contentArrayHandler = function(el)
    el = copy(el)
    el.content = doArrayArray(el.content)
    local result = baseHandler(el)
    return result
  end

  local function denormalize_table_body(body)
    local result = {}
    result.attr = body.attr
    result.body = tmap(body.body, denormalize)
    result.head = tmap(body.head, denormalize)
    result.row_head_columns = body.row_head_columns
    return result
  end

  local typeTable = {
    Pandoc = function(tbl)
      tbl = copy(tbl)
      tbl.blocks = doArray(tbl.blocks)
      tbl.meta = tbl.meta and denormalize_meta(tbl.meta)
      local result = baseHandler(tbl)
      return result
    end,
    BlockQuote = contentHandler,
    BulletList = contentArrayHandler,

    -- unclear what to do here from https://pandoc.org/lua-filters.html#type-definitionlist
    -- DefinitionList = function(element)
    -- end,

    CodeBlock = baseHandler,
    Code = baseHandler,

    Div = contentHandler,

    Header = contentHandler,
    LineBlock = contentHandler,

    OrderedList = function(el)
      el = copy(el)
      el.content = doArrayArray(el.content)
      el.listAttributes = baseHandler(el.listAttributes)
      local result = baseHandler(el)
      return result
    end,

    Para = contentHandler,
    Plain = contentHandler,
    RawBlock = baseHandler,

    Cite = function(el)
      el = copy(el)
      el.content = doArray(el.content)
      el.citations = doArray(el.citations)
      return baseHandler(el)
    end,

    Emph = contentHandler,
    Link = contentHandler,
    Math = baseHandler,
    Note = contentHandler,
    Quoted = contentHandler,
    RawInline = baseHandler,

    SmallCaps = contentHandler,
    Span = contentHandler,
    Strikeout = contentHandler,
    Strong = contentHandler,
    Subscript = contentHandler,
    Superscript = contentHandler,
    Underline = contentHandler,

    Image = function(image)
      image = copy(image)
      image.caption = doArray(image.caption)
      return baseHandler(image)
    end,

    Inlines = function(inlines)
      return quarto.ast._true_pandoc.Inlines(tmap(inlines, denormalize))
    end,

    Blocks = function(blocks)
      return quarto.ast._true_pandoc.Blocks(tmap(blocks, denormalize))
    end,

    Str = function(str)
      return quarto.ast._true_pandoc.Str(str.text)
    end,

    Space = function(space)
      return quarto.ast._true_pandoc.Space()
    end,

    SoftBreak = function()
      return quarto.ast._true_pandoc.SoftBreak()
    end,

    HorizontalRule = function()
      return quarto.ast._true_pandoc.HorizontalRule()
    end,

    LineBreak = function()
      return quarto.ast._true_pandoc.LineBreak()
    end,

    Null = function()
      return quarto.ast._true_pandoc.Null()
    end,
    
    Citation = baseHandler,

    Table = function(tbl)
      tbl = copy(tbl)
      tbl.caption = {
        long = tbl.caption.long and denormalize(tbl.caption.long),
        short = tbl.caption.short and denormalize(tbl.caption.short)
      }
      tbl.head = denormalize(tbl.head)
      tbl.bodies = tmap(tbl.bodies, denormalize_table_body)
      tbl.foot = denormalize(tbl.foot)
      local result = baseHandler(tbl)
      return result
    end,

    SimpleTable = function(tbl)
      tbl = copy(tbl)
      tbl.caption = denormalize(tbl.caption)
      tbl.headers = doArray(tbl.headers)
      tbl.rows = doArrayArray(tbl.rows)
      local result = baseHandler(tbl)
      return result
    end,

    ["pandoc TableFoot"] = function(foot)
      foot = copy(foot)
      foot.rows = tmap(foot.rows, denormalize)
      return baseHandler(foot)
    end,

    -- ["pandoc TableBody"] = function(body)
    --   body = copy(body)
    --   body.body = tmap(body.head, denormalize)
    --   body.head = tmap(body.head, denormalize)
    --   local result = baseHandler(body)
    --   quarto.utils.dump(result)
    --   crash_with_stack_trace()
    --   return result
    -- end,

    ["pandoc TableHead"] = function(head)
      head = copy(head)
      head.rows = tmap(head.rows, denormalize)
      return baseHandler(head)
    end,

    ["pandoc Row"] = function(row)
      row = copy(row)
      row.cells = tmap(row.cells, denormalize)
      return baseHandler(row)
    end,

    ["pandoc Cell"] = function(cell)
      cell = copy(cell)
      cell.contents = tmap(cell.contents, denormalize)
      return baseHandler(cell)
    end,
  }

  if node == " " then
    return quarto.ast._true_pandoc.Space()
  end
  if type(node) == "string" then
    return quarto.ast._true_pandoc.Str(node)
  end
  if type(node) ~= "table" then
    return node
  end

  if node.is_custom then
    local denormalizedTable = {}
    for k, v in pairs(node) do
      if not (k == "t" or k == "tag" or k == "class" or k == "attr" or k == "-is-extended-ast-") then
        denormalizedTable[k] = denormalize(v)
      elseif not (k == "-is-extended-ast-") then
        denormalizedTable[k] = v
      end
    end
    return quarto.ast.build(node.t, denormalizedTable)
  end

  local t = node.t -- ["-quarto-internal-type-"]
  local dispatch = typeTable[t]
  if dispatch == nil then
    if tisarray(node) then
      return tmap(node, denormalize)
    else
      local result = {}
      for k, v in pairs(node) do
        result[k] = denormalize(v)
      end
      return result
    end
  else
    return dispatch(node)
  end
end


function denormalize_meta(node)

  local function unmeta(meta)
    local t = type(meta)
    if t == "number" or t == "boolean" or t == "string" then
      return meta
    end

    local function unmeta_object(obj)
      local result = {}
      local anything_set = false
      for k, v in pairs(meta) do
        anything_set = true
        result[k] = unmeta(v)
      end
      -- TODO it seems that sometimes making the empty MetaList->MetaMap mistake
      -- has rendering consequences (we get a stray "true" rendered into the output), 
      -- but making the empty MetaMap->MetaList mistake
      -- does not. So if we have an empty object, we always call it a MetaList({})
      --
      -- It also seems impossible to know exactly if we have an empty list or empty
      -- map in general...
      if not anything_set then
        return pandoc.MetaList({})
      else
        return result
      end
    end
  
    t = pandoc.utils.type(meta)
    if t == "Meta" then
      return unmeta_object(meta)
    elseif tisarray(meta) and not meta.is_emulated then
      if #meta == 0 then
        return pandoc.MetaList({})
      else
        return tmap(meta, unmeta)
      end
    end
  
    if meta.is_emulated then return denormalize(meta) end
    if t == "Inline" or t == "Block" then return meta end
  
    if type(meta) == "table" then
      return unmeta_object(meta)
    else
      print("Don't know how to unmeta this value:")
      print(type(meta))
      print(t)
      crash_with_stack_trace()
    end
  end

  return unmeta(node)
end
--   if type(node) == "string" then
--     return pandoc.MetaInlines({node})
--   elseif type(node) == "boolean" then
--     return node
--   elseif type(node) == "number" then
--     return node
--   elseif node.t == "Inlines" then
--     local result = denormalize(node)
--     local mlresult = pandoc.MetaInlines({})
--     for k, v in pairs(result) do
--       mlresult:insert(v)
--     end
--     return mlresult
--   elseif node.t == "Blocks" then
--     local result = denormalize(node)
--     local mlresult = pandoc.MetaBlocks({})
--     for k, v in pairs(result) do
--       mlresult:insert(v)
--     end
--     return mlresult
--   elseif node.is_emulated then
--     return denormalize(node) -- just denormalize the values themselves
--   elseif node.t ~= nil then
--     return node -- don't denormalize true pandoc nodes in meta
--   elseif type(node) == "table" then
--     local result = {}
--     local anything_set = false
--     for k, v in pairs(node) do
--       anything_set = true
--       result[k] = denormalize_meta(v)
--     end
--     -- FIXME it seems that sometimes making the empty MetaList->MetaMap mistake
--     -- has rendering consequences, but making the empty MetaMap->MetaList mistake
--     -- does not.
--     --
--     -- It also seems impossible to know exactly if we have an empty list or empty
--     -- map in general...
--     if not anything_set then
--       return pandoc.MetaList({})
--     else
--       return result
--     end
--     -- end
--   else
--     print("Internal Error: can't denormalize_meta this object.")  
--     print(type(node), tostring(node))
--     crash_with_stack_trace()
--   end
-- end