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
    OrderedList = blocksContentArrayHandler,
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

    -- we don't fully normalize Table because it is
    -- almost certainly the case that handling
    -- it correctly requires access to the full object
    -- in a custom handler,

    Table = baseHandler,

    -- default simple behavior for strings and spaces?
    Str = function(s)
      return s.text
    end,

    Space = function(s)
      return " "
    end,

    Blocks = function(blocks)
      return doBlocksArray(blocks)
    end,

    Inlines = function(inlines)
      return doInlinesArray(inlines)
    end,

    -- others
    Citation = baseHandler,
  }

  local t = node.t or pandoc.utils.type(node)
  local dispatch = typeTable[t]
  if dispatch == nil then
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

  local argsTable = {
    Blocks = doArray,
    Inlines = doArray,

    Pandoc = { "blocks", "meta" },
    BlockQuote = { "content" },
    BulletList = { "content" },
    CodeBlock = { "text", "attr" },

    -- we're not normalizing this, so :shrug:
    -- DefinitionList = { "content" },

    Div = { "content", "attr" },
    Header = { "level", "content", "attr" },
    HorizontalRule = {},
    LineBlock = { "content" },
    Null = {},
    OrderedList = { "items", "listAttributes" },
    Para = { "content" },
    Plain = { "content" },
    RawBlock = { "format", "text" },
    Table = { "caption", "colspecs", "head", "bodies", "foot", "attr" },
    Cite = { "content", "citations" },
    Code = { "text", "attr" },
    Emph = { "content" },
    Image = { "caption", "src", "title", "attr" },
    LineBreak = {},
    Link = { "content", "target", "title", "attr" },
    DisplayMath = { "text" },
    InlineMath = { "text" },
    Note = { "content" },
    Quoted = { "quotetype", "content" },
    SingleQuoted = { "content" },
    DoubleQuoted = { "content" },
    RawInline = { "format", "text" },
    SmallCaps = { "content" },
    SoftBreak = {},
    Space = {},
    Span = { "content", "attr" },
    Strikeout = { "content" },
    Strong = { "content" },
    Subscript = { "content" },
    Superscript = { "content" },
    Underline = { "content" },

    -- others
    Citation = { "id", "mode", "prefix", "suffix", "note_num", "hash" },
  }

  local baseHandler = function(tbl)
    local t = tbl.t -- ["-quarto-internal-type-"]
    local v = argsTable[t]
    local args
    if type(v) == "function" then
      return v(tbl)
    else
      args = tmap(v, function(key) 
        return tbl[key] 
      end)
    end
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

  local itemsHandler = function(el)
    el = copy(el)
    el.items = doArray(el.items)
    local result = baseHandler(el)
    return result
  end

  local contentArrayHandler = function(el)
    el = copy(el)
    el.content = doArrayArray(el.content)
    local result = baseHandler(el)
    return result
  end

  local typeTable = {
    Pandoc = function(tbl)
      tbl = copy(tbl)
      tbl.blocks = doArray(tbl.blocks)
      tbl.meta = denormalize_meta(tbl.meta)
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
    OrderedList = itemsHandler,
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

    Table = baseHandler,

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
    
    Citation = baseHandler,
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
      crash_with_stack_trace()
      return node
    end
  else
    return dispatch(node)
  end
end

function denormalize_meta(node)
  if type(node) == "string" then
    return pandoc.MetaInlines({node})
  elseif type(node) == "boolean" then
    return node
  elseif type(node) == "number" then
    return node
  elseif node.t == "Inlines" then
    local result = denormalize(node)
    local mlresult = pandoc.MetaInlines({})
    for k, v in pairs(result) do
      mlresult:insert(v)
    end
    return mlresult
  elseif node.t == "Blocks" then
    local result = denormalize(node)
    local mlresult = pandoc.MetaBlocks({})
    for k, v in pairs(result) do
      mlresult:insert(v)
    end
    return mlresult
  elseif node.is_emulated then
    return denormalize(node) -- just denormalize the values themselves
  elseif node.t ~= nil then
    return node -- don't denormalize true pandoc nodes in meta
  elseif type(node) == "table" then
    local result = {}
    local anything_set = false
    for k, v in pairs(node) do
      anything_set = true
      result[k] = denormalize_meta(v)
    end
    -- FIXME it seems that sometimes making the empty MetaList->MetaMap mistake
    -- has rendering consequences, but making the empty MetaMap->MetaList mistake
    -- does not.
    --
    -- It also seems impossible to know exactly if we have an empty list or empty
    -- map in general...
    if not anything_set then
      return pandoc.MetaList({})
    else
      return result
    end
    -- end
  else
    print("Internal Error: can't denormalize_meta this object.")  
    print(type(node), tostring(node))
    crash_with_stack_trace()
  end
end