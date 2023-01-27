-- asciidoc.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function asciidocFigure(image)
  local renderedCaption = pandoc.write(pandoc.Pandoc({image.caption}))
  return pandoc.RawBlock("asciidoc", "." .. renderedCaption .. "\n[#" .. image.attr.identifier .. "]\nimage::" .. image.src .. "[]" )
end

function asciidocDivFigure(el) 

  local figure = pandoc.List({})
  local id = el.attr.identifier
  
  -- append everything before the caption
  local contents = tslice(el.content, 1, #el.content - 1)
  
  -- return the figure and caption
  local caption = refCaptionFromDiv(el)
  if not caption then
    caption = pandoc.Inlines()
  end
  local renderedCaption = pandoc.write(pandoc.Pandoc({caption}), "asciidoc")

  figure:insert(pandoc.RawBlock('asciidoc', '.' .. renderedCaption))
  figure:insert(pandoc.RawBlock('asciidoc', '[#' .. id .. ']\n'))
  tappend(figure, contents)
  return figure
end
