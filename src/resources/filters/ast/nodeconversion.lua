-- nodeconversion.lua
-- converts to and from quarto's emulated pandoc nodes
--
-- Copyright (C) 2022 by RStudio, PBC

function to_emulated(node)
  local doArray = function(lst)
    return tmap(lst, to_emulated)
  end

  local doBlocksArray = function(lst)
    return pandoc.Blocks(tmap(lst, to_emulated))
  end

  local doInlinesArray = function(lst)
    local emulated = tmap(lst, to_emulated)
    local result = pandoc.Inlines(emulated)
    return result
  end

  local doBlocksArrayArray = function(lst) 
    return tmap(lst, doBlocksArray) 
  end

  local doInlinesArrayArray = function(lst) 
    return tmap(lst, doInlinesArray) 
  end

  local baseHandler = quarto.ast.copy_as_emulated_node

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

  local to_emulated_table_body = function(body)
    return {
      attr = body.attr,
      body = tmap(body.body, to_emulated),
      head = tmap(body.head, to_emulated),
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

    -- we're going to have to do it from the source: pandoc-types/src/Text/Pandoc/Definition.hs
    DefinitionList = function(el)
      -- | DefinitionList [([Inline],[[Block]])]
      local result = baseHandler(el)
      result.content = tmap(result.content, function(innerEl)
        local inner = pandoc.List()
        inner:insert(doInlinesArray(innerEl[1]))
        inner:insert(doBlocksArrayArray(innerEl[2]))
        return inner
      end)
      return result
    end,

    CodeBlock = baseHandler,

    Div = function(div)
      local name = div.attr.attributes["quarto-extended-ast-tag"]
      local handler = quarto.ast.resolve_handler(name)
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
      result.head = to_emulated(result.head)
      result.bodies = tmap(result.bodies, to_emulated_table_body)
      result.foot = to_emulated(result.foot)
      return result
    end,

    ["pandoc TableBody"] = function(body)
      local result = baseHandler(body)
      result.body = tmap(result.body, to_emulated)
      result.head = tmap(result.head, to_emulated)
      return result
    end,

    ["pandoc Row"] = function(row)
      local result = baseHandler(row)
      result.cells = tmap(result.cells, to_emulated)
      return result
    end,

    ["pandoc Cell"] = function(cell)
      local result = baseHandler(cell)
      result.contents = tmap(result.contents, to_emulated)
      return result
    end,

    ["pandoc TableFoot"] = function(foot)
      local result = baseHandler(foot)
      result.rows = tmap(result.rows, to_emulated)      
      return result
    end,

    ["pandoc TableHead"] = function(head)
      local result = baseHandler(head)
      result.rows = tmap(result.rows, to_emulated)      
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
    Citation = function(citation)
      local result = baseHandler(citation)
      result.prefix = doInlinesArray(citation.prefix)
      result.suffix = doInlinesArray(citation.suffix)
      return result
    end,
    ListAttributes = baseHandler,
  }

  local t = node.t or pandoc.utils.type(node)
  local dispatch = typeTable[t]
  if dispatch == nil then
    print("Internal Error in to_emulated(): found nil dispatch for node")
    quarto.utils.dump(node, true)
    print(node)
    print(type(node))
    crash_with_stack_trace()
    return node
  else
    local result = dispatch(node)
    return result
  end
end

function from_emulated(node)
  local doArray = function(lst)
    return tmap(lst, from_emulated)
  end

  local doArrayArray = function(lst)
    return tmap(lst, doArray)
  end

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
    local t = tbl.t
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
    local result = quarto.ast.copy_as_emulated_node(tbl)
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

  local function from_emulated_tablebody(body)
    local result = {}
    result.attr = body.attr
    result.body = tmap(body.body, from_emulated)
    result.head = tmap(body.head, from_emulated)
    result.row_head_columns = body.row_head_columns
    return result
  end

  local function from_emulated_tablefoot(foot)
    foot = copy(foot)
    foot.rows = tmap(foot.rows, from_emulated)
    return baseHandler(foot)
  end

  local function from_emulated_tablehead(head)
    head = copy(head)
    head.rows = tmap(head.rows, from_emulated)
    return baseHandler(head)
  end

  local function from_emulated_tablerow(row)
    row = copy(row)
    row.cells = tmap(row.cells, from_emulated)
    return baseHandler(row)
  end

  local function from_emulated_tablecell(cell)
    cell = copy(cell)
    cell.contents = tmap(cell.contents, from_emulated)
    return baseHandler(cell)
  end

  local typeTable = {
    Pandoc = function(tbl)
      tbl = copy(tbl)
      tbl.blocks = doArray(tbl.blocks)
      tbl.meta = tbl.meta and from_emulated_meta(tbl.meta)
      local result = baseHandler(tbl)
      return result
    end,
    BlockQuote = contentHandler,
    BulletList = contentArrayHandler,

    -- unclear what to do here from https://pandoc.org/lua-filters.html#type-definitionlist
    DefinitionList = function(tbl)
      tbl = copy(tbl)
      tbl.content = tmap(tbl.content, function(innerTbl)
        return {
          doArray(innerTbl[1]),
          doArrayArray(innerTbl[2])
        }
      end)
      local result = baseHandler(tbl)
      return result
    end,

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
      return quarto.ast._true_pandoc.Inlines(tmap(inlines, from_emulated))
    end,

    Blocks = function(blocks)
      return quarto.ast._true_pandoc.Blocks(tmap(blocks, from_emulated))
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
    
    Citation = function(tbl)
      tbl = copy(tbl)
      tbl.prefix = doArray(tbl.prefix)
      tbl.suffix = doArray(tbl.suffix)
      local result = baseHandler(tbl)
      return result
    end,

    Table = function(tbl)
      tbl = copy(tbl)
      tbl.caption = {
        long = tbl.caption.long and from_emulated(tbl.caption.long),
        short = tbl.caption.short and from_emulated(tbl.caption.short)
      }
      tbl.head = from_emulated(tbl.head)
      tbl.bodies = tmap(tbl.bodies, from_emulated_tablebody)
      tbl.foot = from_emulated(tbl.foot)
      local result = baseHandler(tbl)
      return result
    end,

    SimpleTable = function(tbl)
      tbl = copy(tbl)
      tbl.caption = from_emulated(tbl.caption)
      tbl.headers = doArray(tbl.headers)
      tbl.rows = doArrayArray(tbl.rows)
      local result = baseHandler(tbl)
      return result
    end,

    ["pandoc TableFoot"] = from_emulated_tablefoot,
    TableFoot = from_emulated_tablefoot,

    ["pandoc TableHead"] = from_emulated_tablehead,
    TableHead = from_emulated_tablehead,

    ["pandoc Row"] = from_emulated_tablerow,
    Row = from_emulated_tablerow,

    ["pandoc Cell"] = from_emulated_tablecell,
    Cell = from_emulated_tablecell,
  }

  if node == " " then
    return quarto.ast._true_pandoc.Space()
  end
  if type(node) == "string" then
    return quarto.ast._true_pandoc.Str(node)
  end
  -- we want to skip all nodes that aren't emulated or plain tables
  -- while not checking .is_emulated for atomic nodes
  if type(node) ~= "table" then
    if type(node) ~= "userdata" or not node.is_emulated then
      return node
    end
  end

  if node.is_custom then
    local nativeTable = {}
    for k, v in pairs(node) do
      if not (k == "t" or k == "tag" or k == "class" or k == "attr") then
        nativeTable[k] = from_emulated(v)
      else
        nativeTable[k] = v
      end
    end
    return quarto.ast.build(node.t, nativeTable)
  end

  local t = node.t
  local dispatch = typeTable[t]
  if dispatch == nil then
    if tisarray(node) then
      return tmap(node, from_emulated)
    else
      local result = {}
      for k, v in pairs(node) do
        result[k] = from_emulated(v)
      end
      return result
    end
  else
    return dispatch(node)
  end
end


function from_emulated_meta(node)

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
  
    if meta.is_emulated then return from_emulated(meta) end
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