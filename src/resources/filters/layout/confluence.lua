-- confluence.lua
-- Copyright (C) 2023 Posit Software, PBC

-- FIXME this is repeated from overrides.lua but we need to
-- sort out our require() situation first.
local function interpolate(str, vars)
  -- Allow replace_vars{str, vars} syntax as well as replace_vars(str, {vars})
  if not vars then
    vars = str
    str = vars[1]
  end
  return (string.gsub(str, "({([^}]+)})",
          function(whole, i)
            return vars[i] or whole
          end))
end

local function HTMLAnchorConfluence(id)
  if (not id or #id == 0) then
    return pandoc.RawInline("confluence", "")
  end

  local SNIPPET = [[<ac:structured-macro ac:name="anchor" ac:schema-version="1" ac:local-id="a6aa6f25-0bee-4a7f-929b-71fcb7eba592" ac:macro-id="d2cb5be1217ae6e086bc60005e9d27b7"><ac:parameter ac:name="">{id}</ac:parameter></ac:structured-macro>]]

  return pandoc.RawInline("confluence", interpolate {
    SNIPPET,
    id = id or ''
  })
end

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isConfluenceOutput()
end, function(float)
  decorate_caption_with_crossref(float)

  local attr = pandoc.Attr(float.identifier or "", float.classes or {}, float.attributes or {})
  if float.content.t == "Plain" and #float.content.content == 1 and float.content.content[1].t == "Image" then
    local result = float.content.content[1]
    result.caption = quarto.utils.as_inlines(float.caption_long)
    result.attr = merge_attrs(result.attr, attr)
    return pandoc.Blocks({ HTMLAnchorConfluence(float.identifier), result })
  end

  local div_content = pandoc.Div({}, attr)
  div_content.content:insert(float.content)

  if float.caption_long then
    div_content.content:insert(float.caption_long)
  end

  return div_content

  -- local content = pandoc.Blocks({})
  -- return pandoc.Div(content, pandoc.Attr(float.identifier or "", float.classes or {}, float.attributes or {}))
end)

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isConfluenceOutput()
end, function(layout)
  decorate_caption_with_crossref(layout.float)

  if layout.float == nil then
    fail_and_ask_for_bug_report("Confluence format can't render layouts without floats")
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
  if layout.float.caption_long then
    panel_content:insert(pandoc.Para(quarto.utils.as_inlines(layout.float.caption_long) or {}))
  end

  local result = pandoc.Div(panel_content, attr)

  if layout.preamble then
    local pt = pandoc.utils.type(layout.preamble)
    if pt == "Blocks" then
      layout.preamble:insert(result)
      return result
    elseif pt == "Block" then
      return pandoc.Blocks({ layout.preamble, result })
    end
  else
    return result
  end
end)

