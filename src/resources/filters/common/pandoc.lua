-- pandoc.lua
-- Copyright (C) 2020 by RStudio, PBC

-- check for latex output
function isLatexOutput()
  return FORMAT == "latex" or FORMAT == "beamer" or FORMAT == "pdf"
end

function isBeamerOutput()
  return FORMAT == "beamer"
end

-- check for docx output
function isDocxOutput()
  return FORMAT == "docx"
end

-- check for rtf output
function isRtfOutput()
  return FORMAT == "rtf"
end

-- check for odt output
function isOdtOutput()
  return FORMAT == "odt" or FORMAT == "opendocument"
end

-- check for word processor output
function isWordProcessorOutput()
  return FORMAT == "docx" or FORMAT == "rtf" or isOdtOutput()
end

-- check for powerpoint output
function isPowerPointOutput()
  return FORMAT == "pptx"
end

-- check for revealjs output
function isRevealJsOutput()
  return FORMAT == "revealjs"
end

-- check for slide output
function isSlideOutput()
  return isHtmlSlideOutput() or isBeamerOutput() or isPowerPointOutput()
end

-- check for epub output
function isEpubOutput()
  local formats = {
    "epub",
    "epub2",
    "epub3"
  }
  return tcontains(formats, FORMAT)
end

-- check for markdown output
function isMarkdownOutput()
  local formats = {
    "markdown",
    "markdown_github",
    "markdown_mmd", 
    "markdown_phpextra",
    "markdown_strict",
    "gfm",
    "commonmark",
    "commonmark_x",
    "markua"
  }
  return tcontains(formats, FORMAT)
end

-- check for markdown with raw_html enabled
function isMarkdownWithHtmlOutput()
  return isMarkdownOutput() and tcontains(PANDOC_WRITER_OPTIONS.extensions, "raw_html")
end

-- check for ipynb output
function isIpynbOutput()
  return FORMAT == "ipynb"
end

-- check for html output
function isHtmlOutput()
  local formats = {
    "html",
    "html4",
    "html5",
    "epub",
    "epub2",
    "epub3"
  }
  return tcontains(formats, FORMAT) or isHtmlSlideOutput()
end

function isHtmlSlideOutput()
  local formats = {
    "s5",
    "dzslides",
    "slidy",
    "slideous",
    "revealjs",
  }
  return tcontains(formats, FORMAT)
end

function hasBootstrap() 
  local hasBootstrap = param("has-bootstrap", false)
  return hasBootstrap
end


function isRaw(el)
  return el.t == "RawBlock" or el.t == "RawInline"
end

function isRawHtml(rawEl)
  return isRaw(rawEl) and string.find(rawEl.format, "^html") 
end

function isRawLatex(rawEl)
  return isRaw(rawEl) and (rawEl.format == "tex" or rawEl.format == "latex")
end

-- read attribute w/ default
function attribute(el, name, default)
  for k,v in pairs(el.attr.attributes) do
    if k == name then
      return v
    end
  end
  return default
end

function removeClass(classes, remove)
  return classes:filter(function(clz) return clz ~= remove end)
end

function combineFilters(filters) 

  -- the final list of filters
  local filterList = {}
  for _, filter in ipairs(filters) do
    for key,func in pairs(filter) do

      -- ensure that there is a list for this key
      if filterList[key] == nil then
        filterList[key] = pandoc.List()
      end

      -- add the current function to the list
      filterList[key]:insert(func)
    end
  end

  local combinedFilters = {}
  for key,fns in pairs(filterList) do

    combinedFilters[key] = function(x) 
      -- capture the current value
      local current = x

      -- iterate through functions for this key
      for _, fn in ipairs(fns) do
        local result = fn(current)
        if result ~= nil then
          -- if there is a result from this function
          -- update the current value with the result
          current = result
        end
      end

      -- return result from calling the functions
      return current
    end
  end
  return combinedFilters
end

function inlinesToString(inlines)
  return pandoc.utils.stringify(pandoc.Span(inlines))
end

-- lua string to pandoc inlines
function stringToInlines(str)
  if str then
    return pandoc.List({pandoc.Str(str)})
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

function stripTrailingSpace(inlines)
  if #inlines > 0 then
    if inlines[#inlines].t == "Space" then
      return pandoc.List(tslice(inlines, 1, #inlines - 1))
    else
      return inlines
    end
  else
    return inlines
  end
end

-- non-breaking space
function nbspString()
  return pandoc.Str '\u{a0}'
end

-- the first heading in a div is sometimes the caption
function resolveHeadingCaption(div) 
  local capEl = div.content[1]
  if capEl ~= nil and capEl.t == 'Header' then
    div.content:remove(1)
    return capEl.content
  else 
    return nil
  end
end

local kBlockTypes = {
  "BlockQuote",
  "BulletList", 
  "CodeBlock ",
  "DefinitionList",
  "Div",
  "Header",
  "HorizontalRule",
  "LineBlock",
  "Null",
  "OrderedList",
  "Para",
  "Plain",
  "RawBlock",
  "Table"
}

function isBlockEl(el)
  return tcontains(kBlockTypes, el.t)
end

function isInlineEl(el)
  return not isBlockEl(el)
end

