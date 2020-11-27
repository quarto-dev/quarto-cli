

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

