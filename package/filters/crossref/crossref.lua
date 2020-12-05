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

-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- constants
local kHeaderIncludes = "header-includes"

-- ensure that header-includes is a MetaList
function ensureHeaderIncludes(doc)
  if not doc.meta[kHeaderIncludes] then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({})
  elseif doc.meta[kHeaderIncludes].t == "MetaInlines" then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({doc.meta[kHeaderIncludes]})
  end
end

-- add a header include as a raw block
function addHeaderInclude(doc, format, include)
  doc.meta[kHeaderIncludes]:insert(pandoc.MetaBlocks(pandoc.RawBlock(format, include)))
end

-- conditionally include a package
function usePackage(pkg)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage{" .. pkg .. "}}"
end


function metaInjectLatex(doc, func)
  if isLatexOutput() then
    ensureHeaderIncludes(doc)
    addHeaderInclude(doc, "tex", "\\makeatletter")
    func()
    addHeaderInclude(doc, "tex", "\\makeatother")
  end
end

function metaInjectHtml(doc, func)
  if isHtmlOutput() then
    ensureHeaderIncludes(doc)
    function inject(html)
      addHeaderInclude(doc, "html", html)
    end
    func(inject)
  end
end

-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- filter which tags subfigures with their parent identifier. we do this
-- in a separate pass b/c normal filters go depth first so we can't actually
-- "see" our parent figure during filtering
function labelSubfigures()

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

          Para = function(el)
            if (parentId ~= nil) then
              local image = figureFromPara(el)
              if image and isFigureImage(image) then
                image.attr.attributes["figure-parent"] = parentId
              end
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

function collectSubfigures(divEl)
  if isFigureDiv(divEl) then
    local subfigures = pandoc.List:new()
    pandoc.walk_block(divEl, {
      Div = function(el)
        if isSubfigure(el) then
          subfigures:insert(el)
          el.attr.attributes["figure-parent"] = nil
        end
      end,
      Para = function(el)
        local image = figureFromPara(el)
        if image and isSubfigure(image) then
          subfigures:insert(image)
          image.attr.attributes["figure-parent"] = nil
        end
      end,
      HorizontalRule = function(el)
        subfigures:insert(el)
      end
    })
    if #subfigures > 0 then
      return subfigures
    else
      return nil
    end
  else
    return nil
  end
end

-- is this element a subfigure
function isSubfigure(el)
  if el.attr.attributes["figure-parent"] then
    return true
  else
    return false
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

function figureFromPara(el)
  if #el.content == 1 and el.content[1].t == "Image" then
    local image = el.content[1]
    if #image.caption > 0 then
      return image
    else
      return nil
    end
  else
    return nil
  end
end

-- pandoc.lua
-- Copyright (C) 2020 by RStudio, PBC

-- check for latex output
function isLatexOutput()
  return FORMAT == "latex"
end

-- check for docx output
function isDocxOutput()
  return FORMAT == "docx"
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

-- read attribute w/ default
function attribute(el, name, default)
  local value = el.attr.attributes[name]
  if value ~= nil then
    return value
  else
    return default
  end
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

function inlinesToString(inlines)
  return pandoc.utils.stringify(pandoc.Span(inlines))
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
  return option("caption-subfig", true)
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
  
  -- for sections, just return the section levels (we don't currently
  -- support custom numbering for sections since pandoc is often the
  -- one doing the numbering)
  if type == "sec" then
    return stringToInlines(sectionNumber(order.section))
  end

  -- alias num and section (set section to nil if we aren't using chapters)
  local num = order.order
  local section = order.section
  if not option("chapters", false) then
    section = nil
  end
  
  -- return a pandoc.Str w/ chapter prefix (if any)
  function resolve(num)
    if section then
      num = tostring(section[1]) .. "." .. num
    end
    return { pandoc.Str(num) }
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
    -- permits the user to express `roman` or `roman i` or `roman I` to
    -- use lower / uppper case roman numerals
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
    if section then
      tprepend(option, { pandoc.Str(tostring(section[1]) .. ".") })
    end
    return option
  end
end

function sectionNumber(section, maxLevel)
  local num = ""
  for i=1,#section do
    if maxLevel and i>maxLevel then
      break
    end
    if section[i] > 0 then
      if i>1 then
        num = num .. "."
      end
      num = num .. tostring(section[i])
    else
      break
    end
  end
  return num
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
      metaInjectLatex(doc, function()
        
        local caption = usePackage("caption")
        addHeaderInclude(doc, "tex", caption)
        
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
      end)
      
      return doc
    end
  }
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
  table.insert(types, "sec")
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
    CodeBlock = function(el)
      local label = string.match(el.attr.identifier, "^lst:[^ ]+$")
      local caption = el.attr.attributes["lst-cap"]
      if label and caption then
    
        -- the listing number
        local order = indexNextOrder("lst")
        
        -- generate content from markdown caption
        local captionContent = markdownToInlines(caption)
        
        -- add the listing to the index
        indexAddEntry(label, nil, order, captionContent)
       
        if isLatexOutput() then

          -- add listing class to the code block
          el.attr.classes:insert("listing")

          -- if we are use the listings package we don't need to do anything
          -- further, otherwise generate the listing div and return it
          if not latexListings() then
            local listingDiv = pandoc.Div({})
            listingDiv.content:insert(pandoc.RawBlock("latex", "\\begin{codelisting}"))
            local listingCaption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
            listingCaption.content:extend(captionContent)
            listingCaption.content:insert(pandoc.RawInline("latex", "}"))
            listingDiv.content:insert(listingCaption)
            listingDiv.content:insert(el)
            listingDiv.content:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))
            return listingDiv
          end

        else
         
           -- Prepend the title
          tprepend(captionContent, listingTitlePrefix(order))

          -- return a div with the listing
          return pandoc.Div(
            {
              pandoc.Para(captionContent),
              el
            },
            pandoc.Attr(label, {"listing"})
          )
        end

      end
      
      --  if we get this far then just reflect back the el
      return el
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

function latexListings()
  return option("listings", false)
end

-- equations.lua
-- Copyright (C) 2020 by RStudio, PBC

-- process all equations
function equations()
  return {
    Para = processEquations,
    Plain = processEquations
  }
end

function processEquations(blockEl)

  -- alias inlines
  local inlines = blockEl.content

  -- do nothing if there is no math herein
  if inlines:find_if(isDisplayMath) == nil then
    return blockEl
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
          eq.text = eq.text .. " \\qquad(" .. inlinesToString(numberOption("eq", order)) .. ")"
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
  blockEl.content = targetInlines
  return blockEl
 
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

-- process all figures
function figures()
  return {
    Div = function(el)
      if isFigureDiv(el) then
        local caption = figureDivCaption(el)
        processFigure(el, caption.content)
      end
      return el
    end,

    Para = function(el)
      local image = figureFromPara(el)
      if image and isFigureImage(image) then
        processFigure(image, image.caption)
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
      section = nil,
      order = crossref.index.nextSubfigureOrder
    }
    crossref.index.nextSubfigureOrder = crossref.index.nextSubfigureOrder + 1
   
    -- if this isn't latex output, then prepend the subfigure number
    if not isLatexOutput() then
      tprepend(captionContent, { pandoc.Str(")"), pandoc.Space() })
      tprepend(captionContent, subfigNumber(order))
      captionContent:insert(1, pandoc.Str("("))
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
      
      -- skip unnumbered
      if (el.classes:find("unnumbered")) then
        return el
      end
      
      -- cap levels at 7
      local level = math.min(el.level, 7)
      
      -- get the current level
      local currentLevel = currentSectionLevel()
      
      -- if this level is less than the current level
      -- then set subsequent levels to their offset
      if level < currentLevel then
        for i=level+1,#crossref.index.section do
          crossref.index.section[i] = crossref.index.sectionOffsets[i]
        end
      end
      
      -- increment the level counter
      crossref.index.section[level] = crossref.index.section[level] + 1
      
      -- if this is a chapter then notify the index (will be used to 
      -- reset type-counters if we are in "chapters" mode)
      if level == 1 then
        indexNextChapter()
      end
      
      -- if this has a section identifier then index it
      if refType(el.attr.identifier) == "sec" then
        local order = indexNextOrder("sec")
        indexAddEntry(el.attr.identifier, nil, order, el.content)
      end
      
      -- number the section if required
      if (numberSections()) then
        local section = sectionNumber(crossref.index.section, level)
        el.attr.attributes["number"] = section
        el.content:insert(1, pandoc.Space())
        el.content:insert(1, pandoc.Span(
          stringToInlines(section),
          pandoc.Attr("", { "header-section-number"})
        ))
      end
      
      -- return 
      return el
    end
  }
end

function currentSectionLevel()
  -- scan backwards for the first non-zero section level
  for i=#crossref.index.section,1,-1 do
    local section = crossref.index.section[i]
    if section ~= 0 then
      return i
    end
  end
  
  -- if we didn't find one then we are at zero (no sections yet)
  return 0
end

function numberSections()
  return formatRequiresSectionNumber() and option("number-sections", false)
end

function formatRequiresSectionNumber()
  return not isLatexOutput() and not isHtmlOutput() and not isDocxOutput()
end


-- index.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize the index
function initIndex()
  return {
    Pandoc = function(doc)
      
      -- compute section offsets
      local sectionOffsets = pandoc.List:new({0,0,0,0,0,0,0})
      local numberOffset = pandoc.List:new(option("number-offset", {})):map(
        function(offset)
          return tonumber(offset[1].text)
        end
      )
      for i=1,#sectionOffsets do
        if i > #numberOffset then
          break
        end
        sectionOffsets[i] = numberOffset[i]
      end
      
      -- initialize index
      crossref.index = {
        nextOrder = {},
        nextSubfigureOrder = 1,
        section = sectionOffsets,
        sectionOffsets = sectionOffsets,
        entries = {}
      }
      return doc
    end
  }
end

-- advance a chapter
function indexNextChapter()
   -- reset nextOrder to 1 for all types if we are in chapters mode
  if option("chapters", false) then
    for k,v in pairs(crossref.index.nextOrder) do
      crossref.index.nextOrder[k] = 1
    end
  end
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
    section = crossref.index.section:clone(),
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
  labelSubfigures(),
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

