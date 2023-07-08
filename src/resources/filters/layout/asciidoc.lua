-- asciidoc.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function asciidocFigure(image)

  -- the figure that we'll make
  local figure = pandoc.List()

  -- the identififer
  if image.attr.identifier and image.attr.identifier ~= '' then
    figure:extend({"[[" .. image.attr.identifier .. "]]\n"});
  end
  
  -- caption
  local captionText = nil
  if image.caption and #image.caption > 0 then
    captionText = pandoc.write(pandoc.Pandoc({image.caption}), "asciidoc")
    captionText = captionText:gsub("\n", " ")
  end
  if captionText ~= nil then
    figure:extend({"." .. captionText .. "\n"  })
  end

  -- alt text (ok to use HTML entities since alt is expressly for HTML output)
  local altText = image.attr.attributes["alt"] or image.attr.attributes[kFigAlt] or ""
  altText = altText:gsub("\"", "&quot;")
  altText = altText:gsub("<", "&lt;")
  altText = altText:gsub(">", "&gt;")
  altText = altText:gsub("&", "&amp;")

  -- the figure itself
  figure:extend({"image::" .. image.src .. "[\"" .. altText .. "\"]"})

  return pandoc.RawBlock("asciidoc", table.concat(figure, ""))
end

function asciidocDivFigure(el) 

  local figure = pandoc.List({})
  local id = el.attr.identifier
  
  -- append everything before the caption
  local contents = tslice(el.content, 1, #el.content - 1)
  
  -- return the figure and caption
  local caption = refCaptionFromDiv(el)
  if caption then
    local renderedCaption = pandoc.write(pandoc.Pandoc({caption}), "asciidoc")
    figure:insert(pandoc.RawBlock('asciidoc', '.' .. renderedCaption))
  end
  
  if id and id ~= '' then
    figure:insert(pandoc.RawBlock('asciidoc', '[#' .. id .. ']\n'))
  end
  
  tappend(figure, contents)
  return figure
end
