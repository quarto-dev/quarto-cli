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
    captionText = pandoc.write(pandoc.Pandoc({image.caption}), "asciidoctor")
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

  return pandoc.RawBlock("asciidoc", table.concat(figure, "") .. "\n\n")
end

function asciidocDivFigure(el) 

  local figure = pandoc.List({})
  local id = el.attr.identifier
  
  -- append everything before the caption
  local contents = tslice(el.content, 1, #el.content - 1)
  
  -- return the figure and caption
  local caption = refCaptionFromDiv(el)
  if caption then
    local renderedCaption = pandoc.write(pandoc.Pandoc({caption}), "asciidoctor")
    figure:insert(pandoc.RawBlock('asciidoc', '.' .. renderedCaption))
  end
  
  if id and id ~= '' then
    figure:insert(pandoc.RawBlock('asciidoc', '[#' .. id .. ']\n'))
  end
  
  tappend(figure, contents)
  return figure
end

-- FIXME this is the same code as jats.lua except for prepare_caption()
_quarto.ast.add_renderer("PanelLayout", function(layout)
  return _quarto.format.isAsciiDocOutput()
end, function(layout)

  if layout.float == nil then
    fail("don't know how to render a layout without a float")
    return nil
  end

  -- empty options by default
  if not options then
    options = {}
  end
  -- outer panel to contain css and figure panel
  local attr = pandoc.Attr(layout.identifier or "", layout.classes or {}, layout.attributes or {})
  local panel_content = pandoc.Blocks({})
  -- layout
  for i, row in ipairs(layout.layout) do
    
    local aligns = row:map(function(cell) 
      -- get the align
      local align = cell.attributes[kLayoutAlign]
      return layoutTableAlign(align) 
    end)
    local widths = row:map(function(cell) 
      -- propagage percents if they are provided
      local layoutPercent = horizontalLayoutPercent(cell)
      if layoutPercent then
        return layoutPercent / 100
      else
        return 0
      end
    end)

    local cells = pandoc.List()
    for _, cell in ipairs(row) do
      local align = cell.attributes[kLayoutAlign]
      cells:insert(cell)
    end
    
    -- make the table
    local panelTable = pandoc.SimpleTable(
      pandoc.List(), -- caption
      aligns,
      widths,
      pandoc.List(), -- headers
      { cells }
    )
    
    -- add it to the panel
    panel_content:insert(pandoc.utils.from_simple_table(panelTable))
  end

  -- return pandoc.Figure(panel_content, {layout.float.caption_long}, attr)
  -- we'd like to use pandoc.Figure(panel_content, {layout.float.caption_long}, attr)
  -- as the output here, but that doesn't work because
  -- the AsciiDoc Writer for pandoc.Figure doesn't emit caption or identifiers
  -- if the figure content is not exactly one image.
  -- So we have to emit those ourselves.

  

  -- this is exceedingly hacky, but it works.
  local caption_str = pandoc.write(pandoc.Pandoc({layout.float.caption_long}), "asciidoc")

  -- we need to recurse into render_extended_nodes here, sigh
  local content_str = pandoc.write(_quarto.ast.walk(pandoc.Pandoc(panel_content), render_extended_nodes()) or {}, "asciidoc")
  local figure_str = ". " .. caption_str .. "[#" .. layout.identifier .. "]\n" .. content_str

  if layout.preamble then
    return pandoc.Blocks({ layout.preamble, pandoc.RawBlock("asciidoc", figure_str) })
  else
    return pandoc.RawBlock("asciidoc", figure_str)
  end
end)