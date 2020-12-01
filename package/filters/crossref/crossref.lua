-- debug.lua
-- Copyright (C) 2020 by RStudio, PBC

-- dump an object to stdout
function dump(o)
  if type(o) == 'table' then
    tdump(o)
  else
    print(tostring(o) .. "\n")
  end
end

-- improved formatting for dumping tables
function tdump (tbl, indent)
  if not indent then indent = 0 end
  for k, v in pairs(tbl) do
    formatting = string.rep("  ", indent) .. k .. ": "
    if type(v) == "table" then
      print(formatting)
      tdump(v, indent+1)
    elseif type(v) == 'boolean' then
      print(formatting .. tostring(v))
    else
      print(formatting .. v)
    end
  end
end



-- table.lua
-- Copyright (C) 2020 by RStudio, PBC

-- append values to table
function tappend(t, values)
  for i,value in pairs(values) do
    table.insert(t, value)
  end
end

-- prepend values to table
function tprepend(t, values)
  for i=1, #values do
   table.insert(t, 1, values[#values + 1 - i])
  end
end

-- slice elements out of a table
function tslice(t, first, last, step)
  local sliced = {}
  for i = first or 1, last or #t, step or 1 do
    sliced[#sliced+1] = t[i]
  end
  return sliced
end

-- does the table contain a value
function tcontains(t,value)
  if t and type(t)=="table" and value then
    for _, v in ipairs (t) do
      if v == value then
        return true
      end
    end
    return false
  end
  return false
end

-- clear a table
function tclear(t)
  for k,v in pairs(t) do
    t[k] = nil
  end
end

-- get keys from table
function tkeys(t)
  local keyset={}
  local n=0
  for k,v in pairs(t) do
    n=n+1
    keyset[n]=k
  end
  return keyset
end

-- sorted pairs. order function takes (t, a,)
function spairs(t, order)
  -- collect the keys
  local keys = {}
  for k in pairs(t) do keys[#keys+1] = k end

  -- if order function given, sort by it by passing the table and keys a, b,
  -- otherwise just sort the keys
  if order then
      table.sort(keys, function(a,b) return order(t, a, b) end)
  else
      table.sort(keys)
  end

  -- return the iterator function
  local i = 0
  return function()
      i = i + 1
      if keys[i] then
          return keys[i], t[keys[i]]
      end
  end
end

-- pandoc.lua
-- Copyright (C) 2020 by RStudio, PBC

-- check for latex output
function isLatexOutput()
  return FORMAT == "latex"
end

-- check for html output
function isHtmlOutput()
  local formats = {
    "html",
    "html4",
    "html5",
    "s5",
    "dzslides",
    "slidy",
    "slideous",
    "revealjs",
    "epub",
    "epub2",
    "epub3"
  }
  return tcontains(formats, FORMAT)

end

-- combine a set of filters together (so they can be processed in parallel)
function combineFilters(filters)
  local combined = {}
  for _, filter in ipairs(filters) do
    for key,func in pairs(filter) do
      local combinedFunc = combined[key]
      if combinedFunc then
         combined[key] = function(x)
           return func(combinedFunc(x))
         end
      else
        combined[key] = func
      end
    end
  end
  return combined
end

-- lua string to pandoc inlines
function stringToInlines(str)
  if str then
    return {pandoc.Str(str)}
  else
    return nil
  end
end

-- lua string with markdown to pandoc inlines
function markdownToInlines(str)
  if str then
    local doc = pandoc.read(str)
    return doc.blocks[1].content
  else
    return nil
  end
end

-- non-breaking space
function nbspString()
  return pandoc.Str '\u{a0}'
end


-- options.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize options from 'crossref' metadata value
function initOptions()
  return {
    Pandoc = function(doc)
      if type(doc.meta["crossref"]) == "table" then
        crossref.options = doc.meta["crossref"]:clone()
      else
        crossref.options = {}
      end
      return doc
    end
  }
end

-- get option value
function option(name, default)
  local value = crossref.options[name]
  if value == nil then
    value = default
  end
  return value
end




-- format.lua
-- Copyright (C) 2020 by RStudio, PBC

function title(type, default)
  return option(type .. "-title", stringToInlines(default))
end

function titleString(type, default)
  return pandoc.utils.stringify(title(type, default))
end

function titlePrefix(type, default, order)
  local prefix = title(type, default)
  table.insert(prefix, pandoc.Space())
  tappend(prefix, numberOption(type, order))
  tappend(prefix, titleDelim())
  table.insert(prefix, pandoc.Space())
  return prefix
end

function titleDelim()
  return option("title-delim", stringToInlines(":"))
end

function captionSubfig()
  return option("caption-subfig", false)
end

function captionCollectedDelim()
  return option("caption-collected-delim", stringToInlines(",\u{a0}"))
end

function captionCollectedLabelSep()
  return option("caption-collected-label-sep", stringToInlines("\u{a0}—\u{a0}"))
end

function subfigNumber(order)
  return numberOption("subfig", order,  {pandoc.Str("alpha"),pandoc.Space(),pandoc.Str("a")})
end

function refPrefix(type, upper)
  local opt = type .. "-prefix"
  local prefix = option(opt, {pandoc.Str(type), pandoc.Str(".")})
  if upper then
    local el = pandoc.Plain:new(prefix)
    local firstStr = true
    el = pandoc.walk_block(el, {
      Str = function(str)
        if firstStr then
          local strText = text.upper(text.sub(str.text, 1, 1)) .. text.sub(str.text, 2, -1)
          str = pandoc.Str:new(strText)
          firstStr = false
        end
        return str
      end
    })
    prefix = el.content
  end
  return prefix
end

function refDelim()
  return option("ref-delim", stringToInlines(","))
end

function refHyperlink()
  return option("ref-hyperlink", true)
end

function numberOption(type, order, default)
  
  -- alias num
  local num = order.order
  
  -- return a pandoc.Str w/ chapter prefix (if any)
  function resolve(option)
    if order.chapter ~= nil then
      option = tostring(order.chapter) .. "." .. option
    end
    return { pandoc.Str(option) }
  end
  
  -- Compute option name and default value
  local opt = type .. "-labels"
  if default == nil then
    default = stringToInlines("arabic")
  end

  -- determine the style
  local styleRaw = option(opt, default)
  local numberStyle = pandoc.utils.stringify(styleRaw)

  -- process the style
  if (numberStyle == "arabic") then
    return resolve(tostring(num))
  elseif (string.match(numberStyle, "^alpha ")) then
    -- permits the user to include the character that they'd like
    -- to start the numbering with (e.g. alpha a vs. alpha A)
    local startIndexChar = string.sub(numberStyle, -1)
    if (startIndexChar == " ") then
      startIndexChar = "a"
    end
    local startIndex = utf8.codepoint(startIndexChar)
    return resolve(string.char(startIndex + num - 1))
  elseif (string.match(numberStyle, "^roman")) then
    -- permits the user to express `roman` or `roman lower` to
    -- use lower case roman numerals
    local lower = false
    if (string.sub(numberStyle, -#"i") == "i") then
      lower = true
    end
    return resolve(toRoman(num, lower))
  else
    -- otherwise treat the value as a list of values to use
    -- to display the numbers
    local entryCount = #styleRaw

    -- select an index based upon the num, wrapping it around
    local entryIndex = (num - 1) % entryCount + 1
    local option = styleRaw[entryIndex]
    if order.chapter ~= nil then
      tprepend(option, { pandoc.Str(tostring(order.chapter) .. ".") })
    end
    return option
  end
end

function toRoman(num, lower)
  local roman = pandoc.utils.to_roman_numeral(num)
  if lower then
    lower = ''
    for i = 1, #roman do
      lower = lower .. string.char(utf8.codepoint(string.sub(roman,i,i)) + 32)
    end
    return lower
  else
    return roman
  end
end

-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      if isLatexOutput() then
        metaInjectLatex(doc)
      end
      return doc
    end
  }
end

-- inject required latex
function metaInjectLatex(doc)

  ensureHeaderIncludes(doc)

  addHeaderInclude(doc, "tex", "\\makeatletter")

  -- TODO: move this to figures filter?
  local subFig =
    usePackage("subfig") .. "\n" ..
    usePackage("caption") .. "\n" ..
    "\\captionsetup[subfloat]{margin=0.5em}"
  addHeaderInclude(doc, "tex", subFig)

  local floatNames =
    "\\AtBeginDocument{%\n" ..
    "\\renewcommand*\\figurename{" .. titleString("fig", "Figure") .. "}\n" ..
    "\\renewcommand*\\tablename{" .. titleString("tbl", "Table") .. "}\n" ..
    "}\n"
  addHeaderInclude(doc, "tex", floatNames)

  local listNames =
    "\\AtBeginDocument{%\n" ..
    "\\renewcommand*\\listfigurename{" .. listOfTitle("lof", "List of Figures") .. "}\n" ..
    "\\renewcommand*\\listtablename{" .. listOfTitle("lot", "List of Tables") .. "}\n" ..
    "}\n"
  addHeaderInclude(doc, "tex", listNames)

  if latexListings() then
    local lolCommand =
      "\\newcommand*\\listoflistings\\lstlistoflistings\n" ..
      "\\AtBeginDocument{%\n" ..
      "\\renewcommand*\\lstlistlistingname{" .. listOfTitle("lol", "List of Listigs") .. "}\n" ..
      "}\n"
    addHeaderInclude(doc, "tex", lolCommand)
  else
    local codeListing =
      usePackage("float") .. "\n" ..
      "\\floatstyle{ruled}\n" ..
      "\\@ifundefined{c@chapter}{\\newfloat{codelisting}{h}{lop}}{\\newfloat{codelisting}{h}{lop}[chapter]}\n" ..
      "\\floatname{codelisting}{" .. titleString("lst", "Listing") .. "}\n"
    addHeaderInclude(doc, "tex", codeListing)

    local lolCommand =
      "\\newcommand*\\listoflistings{\\listof{codelisting}{" .. listOfTitle("lol", "List of Listings") .. "}}\n"
    addHeaderInclude(doc, "tex", lolCommand)
  end
  
  local theoremIncludes = theoremLatexIncludes()
  if theoremIncludes then
    addHeaderInclude(doc, "tex", theoremIncludes)
  end
  
  addHeaderInclude(doc, "tex", "\\makeatother")

end


-- ensure that header-includes is a MetaList
function ensureHeaderIncludes(doc)
  local kHeaderIncludes = "header-includes"
  if not doc.meta[kHeaderIncludes] then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({})
  elseif doc.meta[kHeaderIncludes].t == "MetaInlines" then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({doc.meta[kHeaderIncludes]})
  end
end

-- add a header include as a raw block
function addHeaderInclude(doc, format, include)
  doc.meta["header-includes"]:insert(pandoc.MetaBlocks(pandoc.RawBlock(format, include)))
end

-- conditionally include a package
function usePackage(pkg)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage{" .. pkg .. "}}"
end

-- latex 'listof' title for type
function listOfTitle(type, default)
  local title = option(type .. "-title")
  if title then
    return pandoc.utils.stringify(title)
  else
    return default
  end
end

-- refs.lua
-- Copyright (C) 2020 by RStudio, PBC

-- resolve references
function resolveRefs()
  
  return {
    Cite = function(citeEl)
      
      -- all valid ref types (so we can provide feedback when one doesn't match)
      local refTypes = validRefTypes()
      
      -- scan citations for refs
      local refs = pandoc.List:new()
      for i, cite in ipairs (citeEl.citations) do
        -- get the label and type, and note if the label is uppercase
        local label = text.lower(cite.id)
        local type = refType(label)
        local upper = not not string.match(cite.id, "^[A-Z]")
        
        -- lookup the label
        local entry = crossref.index.entries[label]
        if entry ~= nil then
      
          -- preface with delimiter unless this is citation 1
          if (i > 1) then
            refs:extend(refDelim())
            refs:extend(stringToInlines(" "))
          end

          -- create ref text
          local ref = pandoc.List:new()
          if #cite.prefix > 0 then
            ref:extend(cite.prefix)
            ref:extend({nbspString()})
          elseif cite.mode ~= pandoc.SuppressAuthor then
            ref:extend(refPrefix(type, upper))
            ref:extend({nbspString()})
          end

          -- for latex inject a \ref, otherwise format manually
          if isLatexOutput() then
            ref:extend({pandoc.RawInline('latex', '\\ref{' .. label .. '}')})
          else
            if entry.parent ~= nil then
              local parentType = refType(entry.parent)
              local parent = crossref.index.entries[entry.parent]
              ref:extend(numberOption(parentType,parent.order))
              ref:extend({pandoc.Space(), pandoc.Str("(")})
              ref:extend(subfigNumber(entry.order))
              ref:extend({pandoc.Str(")")})
            else
              ref:extend(numberOption(type, entry.order))
            end
              -- link if requested
            if (refHyperlink()) then
              ref = {pandoc.Link:new(ref, "#" .. label)}
            end
          end

          -- add the ref
          refs:extend(ref)

        -- no entry for this reference, if it has a valid ref prefix
        -- then yield error text
        elseif tcontains(refTypes, type) then
          local err = pandoc.Strong({ pandoc.Str("?@" .. label) })
          refs:extend({err})
        end
      end

      -- swap citeEl for refs if we found any
      if #refs > 0 then
        return refs
      else
        return citeEl
      end


    end
  }
end

function refLabel(type, inline)
  return string.match(inline.text, "^{#(" .. type .. ":[^ }]+)}$")
end

function refType(id)
  return string.match(id, "^(%a+)%:")
end

function validRefTypes()
  local types = tkeys(theoremTypes())
  table.insert(types, "fig")
  table.insert(types, "tbl")
  table.insert(types, "eq")
  table.insert(types, "lst")
  return types
end


-- theorems.lua
-- Copyright (C) 2020 by RStudio, PBC

function theorems()

  local types = theoremTypes()

  return {
    Div = function(el)

      local type = refType(el.attr.identifier)
      local theoremType = types[type]
      if theoremType then
        
        -- add class for type
        el.attr.classes:insert("theorem")
        if theoremType.env ~= "theorem" then
          el.attr.classes:insert(theoremType.env)
        end
        
        -- capture then remove name
        local name = markdownToInlines(el.attr.attributes["name"])
        el.attr.attributes["name"] = nil 
        
        -- add to index
        local label = el.attr.identifier
        local order = indexNextOrder(type)
        indexAddEntry(label, nil, order, name)
      
        if isLatexOutput() then
          local preamble = pandoc.Para(pandoc.RawInline("latex", 
            "\\begin{" .. theoremType.env .. "}["))
          tappend(preamble.content, name) 
          preamble.content:insert(pandoc.RawInline("latex", "]" ..
            "\\label{" .. label .. "}"))
          el.content:insert(1, preamble)
          el.content:insert(pandoc.Para(pandoc.RawInline("latex", 
            "\\end{" .. theoremType.env .. "}"
          )))
        else
          -- create caption prefix
          local prefix = title(type, theoremType.title)
          table.insert(prefix, pandoc.Space())
          tappend(prefix, numberOption(type, order))
          table.insert(prefix, pandoc.Space())
          if name then
            table.insert(prefix, pandoc.Str("("))
            tappend(prefix, name)
            table.insert(prefix, pandoc.Str(")"))
            table.insert(prefix, pandoc.Space())
          end
        
          -- add caption paragraph if necessary
          if #el.content < 2 then
            tprepend(el.content,  pandoc.Para({}))
          end
          
          -- prepend the prefix
          local caption = el.content[1]
          tprepend(caption.content, { 
            pandoc.Span(
              pandoc.Strong(prefix), 
              pandoc.Attr("", { "theorem-title" })
            )
          })
        end
      
      end
     
      return el
    
    end
  }

end

-- available theorem types
function theoremTypes()
  return pandoc.List({
    thm = {
      env = "theorem",
      style = "plain",
      title = "Theorem"
    },
    lem = {
      env = "lemma",
      style = "plain",
      title = "Lemma"
    },
    cor = {
      env = "corollary",
      style = "plain",
      title = "Corollary",
    },
    prp = {
      env = "proposition",
      style = "plain",
      title = "Proposition",
    },
    cnj = {
      env = "conjecture",
      style = "plain",
      title = "Conjecture"
    },
    def = {
      env = "definition",
      style = "definition",
      title = "Definition",
    },
    exm = {
      env = "example",
      style = "definition",
      title = "Example",
    },
    exr  = {
      env = "exercise",
      style = "definition",
      title = "Exercise"
    }
  })
end

-- theorem latex includes
function theoremLatexIncludes()
  
  -- determine which theorem types we are using
  local types = theoremTypes()
  local refs = tkeys(crossref.index.entries)
  local usingTheorems = false
  for k,v in pairs(crossref.index.entries) do
    local type = refType(k)
    if types[type] then
      usingTheorems = true
      types[type].active = true
    end
  end
  
  -- return requisite latex if we are using theorems
  if usingTheorems then
    local theoremIncludes = "\\usepackage{amsthm}\n"
    for _, type in ipairs(tkeys(types)) do
      if types[type].active then
        theoremIncludes = theoremIncludes .. 
          "\\theoremstyle{" .. types[type].style .. "}\n" ..
          "\\newtheorem{" .. types[type].env .. "}{" .. 
          titleString(type, types[type].title) .. "}[section]\n"
      end
    end
    return theoremIncludes
  else
    return nil
  end
end


-- listings.lua
-- Copyright (C) 2020 by RStudio, PBC

-- process all listings
function listings()

  return {
    Blocks = function(blocks)

      local pendingCodeBlock = nil
      local targetBlocks = pandoc.List:new()

      -- process a listing
      function processListing(label, codeBlock, captionContent)

        -- the listing number
        local order = indexNextOrder("lst")

        if isLatexOutput() then

          -- add attributes to code block
          codeBlock.attr.identifier = label
          codeBlock.attr.classes:insert("listing")

          -- if we are use the listings package just add the caption
          -- attribute and return the block, otherwise generate latex
          if latexListings() then
            codeBlock.attributes["caption"] = pandoc.utils.stringify(
              pandoc.Span(captionContent)
            )
            targetBlocks:insert(codeBlock)
          else
            targetBlocks:insert(pandoc.RawBlock("latex", "\\begin{codelisting}"))
            local caption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
            caption.content:extend(captionContent)
            caption.content:insert(pandoc.RawInline("latex", "}"))
            targetBlocks:insert(caption)
            targetBlocks:insert(codeBlock)
            targetBlocks:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))
          end

          -- add the listing to the index
          indexAddEntry(label, nil, order, captionContent)

        else
          -- add the listing to the index
          indexAddEntry(label, nil, order, captionContent)

           -- Prepend the title
          tprepend(captionContent, listingTitlePrefix(order))

          -- add the list to the output blocks
          targetBlocks:insert(pandoc.Div(
            {
              pandoc.Para(captionContent),
              codeBlock
            },
            pandoc.Attr(label, {"listing"})
          ))
        end

      end

      for i, el in ipairs(blocks) do

        -- should we proceed with inserting this block?
        local insertBlock = true

        -- see if this is a code block with a listing label/caption
        if el.t == "CodeBlock" then

          if pendingCodeBlock then
            targetBlocks:insert(pendingCodeBlock)
            pendingCodeBlock = nil
          end

          local label = string.match(el.attr.identifier, "^lst:[^ ]+$")
          local caption = el.attr.attributes["caption"]
          if label and caption then
            processListing(label, el, markdownToInlines(caption))
          else
            pendingCodeBlock = el
          end

          insertBlock = false

        -- process pending code block
        elseif pendingCodeBlock then
          if isListingCaption(el) then

            -- find the label
            local lastInline = el.content[#el.content]
            local label = refLabel("lst", lastInline)

            -- remove the id from the end
            el.content = tslice(el.content, 1, #el.content-2)

            -- Slice off the colon and space
            el.content = tslice(el.content, 3, #el.content)

            -- process the listing
            processListing(label, pendingCodeBlock, el.content)

            insertBlock = false
          else
            targetBlocks:insert(pendingCodeBlock)
          end
          pendingCodeBlock = nil
        end

        -- either capture the code block or just emit the el
        if insertBlock then
          targetBlocks:insert(el)
        end
      end

      if pendingCodeBlock then
        targetBlocks:insert(pendingCodeBlock)
      end

      return targetBlocks
    end
  }
end

function listingTitlePrefix(order)
  return titlePrefix("lst", "Listing", order)
end

function prependTitlePrefix(caption, label, order)
  if isLatexOutput() then
     tprepend(caption.content, {
       pandoc.RawInline('latex', '\\label{' .. label .. '}')
     })
  else
     tprepend(caption.content, tableTitlePrefix(order))
  end
end

function isListingCaption(el)
  if el.t == "Para" then
    local contentStr = pandoc.utils.stringify(el)
    return string.find(contentStr, "^:%s+[^%s].*%s{#lst:[^ }]+}$")
  else
    return false
  end
end

function latexListings()
  return option("listings", false)
end

-- equations.lua
-- Copyright (C) 2020 by RStudio, PBC

-- process all equations
function equations()

  return {
    Inlines = function(inlines)

      -- do nothing if there is no math herein
      if inlines:find_if(isDisplayMath) == nil then
        return inlines
      end

      local mathInlines = nil
      local targetInlines = pandoc.List:new()

      for i, el in ipairs(inlines) do

        -- see if we need special handling for pending math, if
        -- we do then track whether we should still process the
        -- inline at the end of the loop
        local processInline = true
        if mathInlines then
          if el.t == "Space" then
            mathInlines:insert(el.t)
            processInline = false
          elseif el.t == "Str" and refLabel("eq", el) then

            -- add to the index
            local label = refLabel("eq", el)
            local order = indexNextOrder("eq")
            indexAddEntry(label, nil, order)

            -- get the equation
            local eq = mathInlines[1]

            -- write equation
            if isLatexOutput() then
              targetInlines:insert(pandoc.RawInline("latex", "\\begin{equation}"))
              targetInlines:insert(pandoc.Span(pandoc.RawInline("latex", eq.text), pandoc.Attr(label)))
              targetInlines:insert(pandoc.RawInline("latex", "\\label{" .. label .. "}\\end{equation}"))
            else
              eq.text = eq.text .. " \\qquad(" .. tostring(order) .. ")"
              local span = pandoc.Span(eq, pandoc.Attr(label))
              targetInlines:insert(span)
            end

            -- reset state
            mathInlines = nil
            processInline = false
          else
            targetInlines:extend(mathInlines)
            mathInlines = nil
          end
        end

        -- process the inline unless it was already taken care of above
        if processInline then
          if isDisplayMath(el) then
              mathInlines = pandoc.List:new()
              mathInlines:insert(el)
            else
              targetInlines:insert(el)
          end
        end

      end

      -- flush any pending math inlines
      if mathInlines then
        targetInlines:extend(mathInlines)
      end

      -- return the processed list
      return targetInlines

    end
  }

end

function isDisplayMath(el)
  return el.t == "Math" and el.mathtype == "DisplayMath"
end

-- tables.lua
-- Copyright (C) 2020 by RStudio, PBC

-- process all tables
function tables()
  return {
    Div = function(el)
      if isTableDiv(el) then
        -- look for various ways of expressing tables in a div
        local processors = { processMarkdownTable, processRawTable }
        for _, process in ipairs(processors) do
          local tblDiv = process(el)
          if tblDiv then
            return tblDiv
          end
        end
      end
      -- default to just reflecting the div back
      return el
    end,

    Table = function(el)
      -- if there is a caption then check it for a table suffix
      if el.caption.long ~= nil then
        local last = el.caption.long[#el.caption.long]
        if last and #last.content > 2 then
          local lastInline = last.content[#last.content]
          local label = refLabel("tbl", lastInline)
          if label and last.content[#last.content-1].t == "Space" then
            -- remove the id from the end
            last.content = tslice(last.content, 1, #last.content-2)

            -- add the table to the index
            local order = indexNextOrder("tbl")
            indexAddEntry(label, nil, order, last.content)

            -- insert table caption (use \label for latex)
            prependTitlePrefix(last, label, order)

            -- wrap in a div with the label (so that we have a target
            -- for the tbl ref, in LaTeX that will be a hypertarget)
            return pandoc.Div(el, pandoc.Attr(label))
          end
        end
      end
      return el
    end
  }
end

function processMarkdownTable(divEl)
  for i,el in pairs(divEl.content) do
    if el.t == "Table" then
      if el.caption.long ~= nil then
        local caption = el.caption.long[#el.caption.long]
        local label = divEl.attr.identifier
        local order = indexNextOrder("tbl")
        indexAddEntry(label, nil, order, caption.content)
        prependTitlePrefix(caption, label, order)
        return divEl
      end
    end
  end
  return nil
end

function processRawTable(divEl)
  -- look for a raw html or latex table
  for i,el in pairs(divEl.content) do
    local rawParentEl, rawEl, rawIndex = rawElement(divEl, el, i)
    if rawEl then
      local label = divEl.attr.identifier
      -- html table
      if string.find(rawEl.format, "^html") then
        local tag = "[Cc][Aa][Pp][Tt][Ii][Oo][Nn]"
        local captionPattern = "(<" .. tag .. "[^>]*>)(.*)(</" .. tag .. ">)"
        local _, caption, _ = string.match(rawEl.text, captionPattern)
        if caption then
          local order = indexNextOrder("tbl")
          indexAddEntry(label, nil, order, stringToInlines(caption))
          local prefix = pandoc.utils.stringify(tableTitlePrefix(order))
          rawEl.text = rawEl.text:gsub(captionPattern, "%1" .. prefix .. "%2%3", 1)
          rawParentEl.content[rawIndex] = rawEl
          return divEl
        end
      -- latex table
      elseif rawEl.format == "tex" or  rawEl.format == "latex" then
        -- knitr kable latex output will already have a label w/ tab:
        -- prefix. in that case simply replace it
        local captionPattern = "\\caption{\\label{tab:" .. label .. "}([^}]+)}"
        local caption = string.match(rawEl.text, captionPattern)
        if caption then
          processLatexTable(rawEl, captionPattern, label, caption)
          rawParentEl.content[rawIndex] = rawEl
          return divEl
        end

        -- look for raw latex with a caption
        captionPattern = "\\caption{([^}]+)}"
        caption = string.match(rawEl.text, captionPattern)
        if caption then
           processLatexTable(rawEl, captionPattern, label, caption)
           rawParentEl.content[rawIndex] = rawEl
           return divEl
        end
      end
      break
    end
  end

  return nil
end

-- handle either a raw block or raw inline in first paragraph
function rawElement(divEl, el, index)
  if el.t == "RawBlock" then
    return divEl, el, index
  elseif el.t == "Para" and #el.content > 0 and el.content[1].t == "RawInline" then
    return el, el.content[1], 1
  end
end

-- is this a Div containing a table?
function isTableDiv(el)
  return el.t == "Div" and hasTableLabel(el)
end

-- does this element have a table label?
function hasTableLabel(el)
  return string.match(el.attr.identifier, "^tbl:")
end


function tableTitlePrefix(order)
  return titlePrefix("tbl", "Table", order)
end


function processLatexTable(el, captionPattern, label, caption)
  el.text = el.text:gsub(captionPattern, "\\caption{\\label{" .. label .. "}" .. caption .. "}", 1)
  local order = indexNextOrder("tbl")
  indexAddEntry(label, nil, order, stringToInlines(caption))
end

function prependTitlePrefix(caption, label, order)
  if isLatexOutput() then
     tprepend(caption.content, {
       pandoc.RawInline('latex', '\\label{' .. label .. '}')
     })
  else
     tprepend(caption.content, tableTitlePrefix(order))
  end
end

-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- filter which tags subfigures with their parent identifier. we do this
-- in a separate pass b/c normal filters go depth first so we can't actually
-- "see" our parent figure during filtering
function subfigures()

  return {
    Pandoc = function(doc)
      local walkFigures
      walkFigures = function(parentId)
        return {
          Div = function(el)
            if isFigureDiv(el) then
              if parentId ~= nil then
                el.attr.attributes["figure-parent"] = parentId
              else
                el = pandoc.walk_block(el, walkFigures(el.attr.identifier))
              end
            end
            return el
          end,

          Image = function(el)
            if (parentId ~= nil) and hasFigureLabel(el) and (#el.caption > 0)  then
              el.attr.attributes["figure-parent"] = parentId
            end
            return el
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do
        local parentId = nil
        if isFigureDiv(el) then
          parentId = el.attr.identifier
        end
        doc.blocks[i] = pandoc.walk_block(el, walkFigures(parentId))
      end
      return doc

    end
  }
end

-- process all figures
function figures()
  return {
    Div = function(el)
      if isFigureDiv(el) then
        local caption = figureDivCaption(el)
        processFigure(el, caption.content)
        appendSubfigureCaptions(el)
      end
      return el
    end,

    Image = function(el)
      if isFigureImage(el) then
        processFigure(el, el.caption)
      end
      return el
    end
  }
end



-- process a figure, re-writing it's caption as necessary and
-- adding it to the global index of figures
function processFigure(el, captionContent)
  -- get label and base caption
  local label = el.attr.identifier
  local caption = captionContent:clone()

  -- determine order, parent, and displayed caption
  local order
  local parent = el.attr.attributes["figure-parent"]
  if (parent) then
    el.attr.attributes["figure-parent"] = nil
    order = {
      chapter = nil,
      order = crossref.index.nextSubfigureOrder
    }
    crossref.index.nextSubfigureOrder = crossref.index.nextSubfigureOrder + 1
    -- we have a parent, so clear the table then insert a letter (e.g. 'a')
    tclear(captionContent)
    if captionSubfig() and not tcontains(el.attr.classes, "nocaption") then
      tappend(captionContent, subfigNumber(order))
    end
  else
    order = indexNextOrder("fig")
    if not isLatexOutput() then
      tprepend(captionContent, figureTitlePrefix(order))
    end
  end

  -- update the index
  indexAddEntry(label, parent, order, caption)
end

-- append any avavilable subfigure captions to the div
function appendSubfigureCaptions(div)

  -- look for subfigures
  local subfigures = {}
  for label,figure in pairs(crossref.index.entries) do
    if (div.attr.identifier == figure.parent) then
      subfigures[label] = figure
    end
  end

  -- get caption element
  local captionContent = div.content[#div.content].content

  -- append to caption in order of insertion
  for label,figure in spairs(subfigures, function(t, a, b) return t[a].order.order < t[b].order.order end) do
    if figure.order.order == 1 then
      table.insert(captionContent, pandoc.Str(". "))
    else
      tappend(captionContent, captionCollectedDelim())
    end

    tappend(captionContent, subfigNumber(figure.order))
    tappend(captionContent, captionCollectedLabelSep())
    tappend(captionContent, figure.caption)
  end
end

-- is this a Div containing a figure
function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el) and (figureDivCaption(el) ~= nil)
end

-- is this an image containing a figure
function isFigureImage(el)
  return hasFigureLabel(el) and #el.caption > 0
end

-- does this element have a figure label?
function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
end

function figureDivCaption(el)
  local last = el.content[#el.content]
  if last and last.t == "Para" and #el.content > 1 then
    return last
  else
    return nil
  end
end



function figureTitlePrefix(order)
  return titlePrefix("fig", "Figure", order)
end

-- sections.lua
-- Copyright (C) 2020 by RStudio, PBC

function sections()
  return {
    Header = function(el)
      -- track current chapter
      if el.level == 1 then
        indexNextChapter()
      end
    end
  }
end

-- index.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize the index
function initIndex()
  return {
    Pandoc = function(doc)
      crossref.index = {
        nextOrder = {},
        nextSubfigureOrder = 1,
        currentChapter = nil,
        entries = {}
      }
      if option("chapters", false) then
        crossref.index.currentChapter = 0
      end
      return doc
    end
  }
end

-- advance a chapter
function indexNextChapter()
  if option("chapters", false) then
    -- bump current chapter
    crossref.index.currentChapter = crossref.index.currentChapter + 1
    
    -- reset nextOrder to 1 for all types
    for k,v in pairs(crossref.index.nextOrder) do
      crossref.index.nextOrder[k] = 1
    end
  end
  return crossref.index.currentChapter
end

-- next sequence in index for type
function indexNextOrder(type)
  if not crossref.index.nextOrder[type] then
    crossref.index.nextOrder[type] = 1
  end
  local nextOrder = crossref.index.nextOrder[type]
  crossref.index.nextOrder[type] = crossref.index.nextOrder[type] + 1
  crossref.index.nextSubfigureOrder = 1
  return {
    chapter = crossref.index.currentChapter,
    order = nextOrder
  }
end

-- add an entry to the index
function indexAddEntry(label, parent, order, caption)
  if caption ~= nil then
    caption = pandoc.List:new(caption)
  end
  crossref.index.entries[label] = {
    parent = parent,
    order = order,
    caption = caption,
  }
end

-- does our index already contain this element?
function indexHasElement(el)
  return crossref.index.entries[el.attr.identifier] ~= nil
end

-- crossref.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required modules
text = require 'text'

-- global crossref state
crossref = {}



-- chain of filters
return {
  initOptions(),
  initIndex(),
  subfigures(),
  combineFilters({
    sections(),
    figures(),
    tables(),
    equations(),
    listings(),
    theorems()
  }),
  resolveRefs(),
  metaInject(),
}

