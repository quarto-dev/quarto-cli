-- hugo.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isHugoMarkdownOutput()
end, function(layout)
  if layout.float == nil then
    fail_and_ask_for_bug_report("Can't render layouts without floats")
    return pandoc.Div({})
  end
  decorate_caption_with_crossref(layout.float)

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

  local result = pandoc.Div({})
  -- the format for the rawblock is html and not markdown_strict
  -- because this might end up inside a table, and Pandoc
  -- ignores markdown_strict raw blocks that are inside tables 
  result.content:insert(pandoc.RawBlock("html", "<div id=\"" .. layout.float.identifier .. "\">"))
  result.content:extend(panel_content)

  if layout.float.caption_long then
    result.content:insert(pandoc.Para(quarto.utils.as_inlines(layout.float.caption_long) or {}))
  end
  result.content:insert(pandoc.RawBlock("html", "</div>"))

  local res = pandoc.Blocks({})
  panel_insert_preamble(res, layout.preamble)
  res:insert(result)

  return res

end)

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isHugoMarkdownOutput()
end, function(float)
  decorate_caption_with_crossref(float)
  local el = quarto.utils.match("Plain/[1]/Image")(float.content)
  if el then
    local text = pandoc.write(pandoc.Pandoc({
      pandoc.Image(
        pandoc.utils.stringify(quarto.utils.as_inlines(float.caption_long)),
        el.src,
        "",
        pandoc.Attr(float.identifier, {}, {}))}), "html")
    -- we use "html" here because otherwise
    -- Pandoc appears to not want to emit the right thing
    -- when the output is inside a table
    -- Pandoc is also emitting bizarre (but ultimately harmless) newline entities inside tables
    -- if we add the newline here, but if we don't add newlines,
    -- then images by themselves don't have line breaks after them
    local result = pandoc.RawInline("html", text .. "\n")
    return result
  end
  el = quarto.utils.match("Plain/[1]/{Link}/[1]/{Image}")(float.content)
  if el then
    local link = el[1]
    local image = el[2]
    image.identifier = float.identifier
    image.caption = quarto.utils.as_inlines(float.caption_long)
    return link
  end
  el = quarto.utils.match("CodeBlock")(float.content)
  if el then
    float.content.classes:extend(float.classes)
    for k, v in pairs(float.attributes) do
      float.content.attributes[k] = v
    end
  end

  local start_div = pandoc.RawBlock("html", "<div id=\"" .. float.identifier .. "\">")
  local end_div = pandoc.RawBlock("html", "</div>")
  local result = pandoc.Blocks({start_div})
  quarto.utils.add_to_blocks(result, float.content)
  quarto.utils.add_to_blocks(result, float.caption_long)
  result:insert(end_div)
  return result
end)

function render_hugo_fixups()
  if not _quarto.format.isHugoMarkdownOutput() then
    return {}
  end
  return {
    Div = function(div)
      if div.identifier:match("ojs%-cell%-") then
        return pandoc.RawBlock("markdown", '<div id="' .. div.identifier .. '"></div>')
      end
    end
  }
end