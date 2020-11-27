-- required modules
text = require 'text'

-- chain of filters
return {
  initOptions(),
  figures(),
  tables(),
  equations(),
  listings(),
  metaInject(),
  resolveRefs(),
}

-- global crossref state
crossref = {
  index = {
    nextOrder = {},
    nextSubfigureOrder = 1,
    entries = {}
  },
  options = {}
}

-- next sequence in index for type
function indexNextOrder(type)
  if not crossref.index.nextOrder[type] then
    crossref.index.nextOrder[type] = 1
  end
  local nextOrder = crossref.index.nextOrder[type]
  crossref.index.nextOrder[type] = crossref.index.nextOrder[type] + 1
  crossref.index.nextSubfigureOrder = 1
  return nextOrder
end

-- add an entry to the index
function indexAddEntry(label, parent, order, caption)
  if caption ~= nil then
    caption = pandoc.List:new(caption)
  end
  crossref.index.entries[label] = {
    parent = parent,
    order = order,
    caption = caption
  }
end

-- does our index already contain this element?
function indexHasElement(el)
  return crossref.index.entries[el.attr.identifier] ~= nil
end

-- process all figures, fixing up figure captions as required and
-- and returning an index of all the figures
function figures()

  return {
    Pandoc = function(doc)
      -- look for figures in Div and Image elements. Note that both of the
      -- Div and Image handlers verify that they aren't already in the
      -- index before proceeding. This is because the pandoc.walk_block
      -- function will traverse the entire tree, however in the case of
      -- parent figure divs we may have already traversed the subtree
      -- beneath the parent div (and there is no way to stop walk_block
      -- from re-traversing)
      local walkFigures
      walkFigures = function(parent)
        return {

          -- if it's a figure div we haven't seen before then process
          -- it and walk it's children to find subfigures
          Div = function(el)
            if isFigureDiv(el) and not indexHasElement(el) then
              if processFigureDiv(el, parent) then
                el = pandoc.walk_block(el, walkFigures(el))
                -- update caption of parent if we had subfigures
                appendSubfigureCaptions(el)
              end
            end
            return el
          end,

          -- if it's a figure image we haven't seen before then process it
          -- if it carries a caption
          Image = function(el)
            if hasFigureLabel(el) and not indexHasElement(el) then
              if #el.caption > 0 then
                processFigure(el, el.caption, parent)
              end
            end
            return el
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do

        -- process any root level figure divs (note parent for
        -- potential subfigure discovery)
        local parent = nil
        if isFigureDiv(el) then
          if processFigureDiv(el, parent) then
            parent = el
          end
        end

        -- walk the black
        doc.blocks[i] = pandoc.walk_block(el, walkFigures(parent))

        -- update caption of parent if we had subfigures
        if parent then
           appendSubfigureCaptions(doc.blocks[i])
        end
      end

      return doc

    end
  }
end

-- process a div labeled as a figure (ensures that it has a caption before
-- delegating to processFigure)
function processFigureDiv(el, parent)

  -- ensure that there is a trailing paragraph to serve as caption
  local last = el.content[#el.content]
  if last and last.t == "Para" and #el.content > 1 then
    processFigure(el, last.content, parent)
    return true
  else
    return false
  end
end

-- process a figure, re-writing it's caption as necessary and
-- adding it to the global index of figures
function processFigure(el, captionEl, parentEl)
  -- get label and base caption
  local label = el.attr.identifier
  local caption = captionEl:clone()

  -- determine parent, order, and displayed caption
  local parent = nil
  local order
  if (parentEl) then
    parent = parentEl.attr.identifier
    order = crossref.index.nextSubfigureOrder
    crossref.index.nextSubfigureOrder = crossref.index.nextSubfigureOrder + 1
    -- we have a parent, so clear the table then insert a letter (e.g. 'a')
    tclear(captionEl)
    if captionSubfig() and not tcontains(el.attr.classes, "nocaption") then
      tappend(captionEl, subfigNumber(order))
    end
  else
    order = indexNextOrder("fig")
    if not isLatexOutput() then
      tprepend(captionEl, figureTitlePrefix(order))
    end
  end

  -- update the index
  indexAddEntry(label, parent, order, caption.content)
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
  local captionEl = div.content[#div.content].content

  -- append to caption in order of insertion
  for label,figure in spairs(subfigures, function(t, a, b) return t[a].order < t[b].order end) do
    if figure.order == 1 then
      table.insert(captionEl, pandoc.Str(". "))
    else
      tappend(captionEl, captionCollectedDelim())
    end

    tappend(captionEl, subfigNumber(figure.order))
    tappend(captionEl, captionCollectedLabelSep())
    tappend(captionEl, figure.caption)
  end
end

-- is this a Div containing a figure
function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el)
end

-- does this element have a figure label?
function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
end


function figureTitlePrefix(num)
  return titlePrefix("fig", "Figure", num)
end

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


function tableTitlePrefix(num)
  return titlePrefix("tbl", "Table", num)
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
            codeBlock.attributes["caption"] = pandoc.utils.stringify(el)
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

function listingTitlePrefix(num)
  return titlePrefix("lst", "Listing", num)
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

-- resolve references
function resolveRefs()

  return {
    Cite = function(citeEl)
      -- scan citations for refs
      local refs = pandoc.List:new()
      for i, cite in ipairs (citeEl.citations) do
        local entry = crossref.index.entries[text.lower(cite.id)]
        if entry ~= nil then
          -- get the type (note if it's uppercase)
          local type = refType(cite.id)
          local upper = not not string.match(cite.id, "^[A-Z]")
          type = text.lower(type)

          -- get the label
          local label = text.lower(cite.id)

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

function title(type, default)
  return option(type .. "-title", stringToInlines(default))
end

function titleString(type, default)
  return pandoc.utils.stringify(title(type, default))
end

function titlePrefix(type, default, num)
  local prefix = title(type, default)
  table.insert(prefix, pandoc.Space())
  tappend(prefix, numberOption(type, num))
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

function subfigNumber(num)
  return numberOption("subfig", num,  {pandoc.Str("alpha"),pandoc.Space(),pandoc.Str("a")})
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

function numberOption(type, num, default)
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
    return {pandoc.Str(tostring(num))}
  elseif (string.match(numberStyle, "^alpha ")) then
    -- permits the user to include the character that they'd like
    -- to start the numbering with (e.g. alpha a vs. alpha A)
    local startIndexChar = string.sub(numberStyle, -1)
    if (startIndexChar == " ") then
      startIndexChar = "a"
    end
    local startIndex = utf8.codepoint(startIndexChar)
    return {pandoc.Str(string.char(startIndex + num - 1))}
  elseif (string.match(numberStyle, "^roman")) then
    -- permits the user to express `roman` or `roman lower` to
    -- use lower case roman numerals
    local lower = false
    if (string.sub(numberStyle, -#"i") == "i") then
      lower = true
    end
    return {pandoc.Str(toRoman(num, lower))}
  else
    -- otherwise treat the value as a list of values to use
    -- to display the numbers
    local entryCount = #styleRaw

    -- select an index based upon the num, wrapping it around
    local entryIndex = (num - 1) % entryCount + 1
    return styleRaw[entryIndex]
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

-- initialize options from 'crossref' metadata value
function initOptions()
  return {
    Pandoc = function(doc)
      if type(doc.meta["crossref"]) == "table" then
        crossref.options = doc.meta["crossref"]:clone()
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

-- lua string to pandoc inlines
function stringToInlines(str)
  return {pandoc.Str(str)}
end

-- lua string with markdown to pandoc inlines
function markdownToInlines(str)
  local doc = pandoc.read(str)
  return doc.blocks[1].content
end

-- non-breaking space
function nbspString()
  return pandoc.Str '\u{a0}'
end



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


