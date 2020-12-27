-- pandoc.lua
-- Copyright (C) 2020 by RStudio, PBC

-- check for latex output
function isLatexOutput()
  return FORMAT == "latex" or FORMAT == "beamer" or FORMAT == "pdf"
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

function isRawHtml(rawEl)
  return string.find(rawEl.format, "^html") 
end

function isRawLatex(rawEl)
  return rawEl.format == "tex" or  rawEl.format == "latex"
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

-- combine a set of filters together (so they can be processed in parallel)
function combineFilters(filters)
  local combined = {}
  for _, filter in ipairs(filters) do
    for key,func in pairs(filter) do
      local combinedFunc = combined[key]
      if combinedFunc then
        combined[key] = function(x)
          local result = combinedFunc(x)
          if result then
            return func(result)
          else
            return func(x)
          end
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
    return pandoc.List:new({pandoc.Str(str)})
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


