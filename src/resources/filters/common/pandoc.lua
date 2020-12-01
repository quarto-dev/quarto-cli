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

