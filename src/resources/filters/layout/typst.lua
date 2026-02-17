-- typst.lua
-- Copyright (C) 2023 Posit Software, PBC

-- Full-width column class mapping for wideblock
-- Note: screen-inset classes are handled separately with column-screen-inset function
local widthClassToSide = {
  ["column-page-right"] = "outer",
  ["column-page-left"] = "inner",
  ["column-page"] = "both",
  ["column-screen"] = "both",
  ["column-screen-left"] = "inner",
  ["column-screen-right"] = "outer",
}

-- Check if element has a full-width class and return the wideblock side
function getWideblockSide(classes)
  if classes == nil then
    return nil, nil
  end
  for clz, side in pairs(widthClassToSide) do
    if classes:includes(clz) then
      return side, clz
    end
  end
  return nil, nil
end

-- Intermediate width classes map to Typst functions with side parameter
local intermediateWidthClasses = {
  ["column-body-outset"] = { func = "column-body-outset", side = "both" },
  ["column-body-outset-left"] = { func = "column-body-outset", side = "inner" },
  ["column-body-outset-right"] = { func = "column-body-outset", side = "outer" },
  ["column-page-inset"] = { func = "column-page-inset", side = "both" },
  ["column-page-inset-left"] = { func = "column-page-inset", side = "inner" },
  ["column-page-inset-right"] = { func = "column-page-inset", side = "outer" },
  ["column-screen-inset"] = { func = "column-screen-inset", side = "both" },
  ["column-screen-inset-left"] = { func = "column-screen-inset", side = "inner" },
  ["column-screen-inset-right"] = { func = "column-screen-inset", side = "outer" },
  ["column-screen-inset-shaded"] = { func = "column-screen-inset-shaded", side = nil },
}

-- Check if element has an intermediate width class
function getIntermediateWidthClass(classes)
  if classes == nil then
    return nil, nil
  end
  for clz, info in pairs(intermediateWidthClasses) do
    if classes:includes(clz) then
      return info, clz
    end
  end
  return nil, nil
end

-- Wrap content in intermediate width block
function make_typst_intermediate_width(tbl)
  local content = tbl.content or pandoc.Blocks({})
  local func = tbl.func
  local side = tbl.side

  local result = pandoc.Blocks({})
  if side then
    result:insert(pandoc.RawBlock("typst", '#' .. func .. '(side: "' .. side .. '")['))
  else
    result:insert(pandoc.RawBlock("typst", '#' .. func .. '['))
  end
  result:extend(quarto.utils.as_blocks(content))
  result:insert(pandoc.RawBlock("typst", ']\n\n'))
  return result
end

-- Wrap content in a wideblock for full-width layout
function make_typst_wideblock(tbl)
  local content = tbl.content or pandoc.Blocks({})
  local side = tbl.side or "both"

  local result = pandoc.Blocks({})
  result:insert(pandoc.RawBlock("typst", '#wideblock(side: "' .. side .. '")['))
  result:extend(quarto.utils.as_blocks(content))
  result:insert(pandoc.RawBlock("typst", ']'))
  result:insert(pandoc.RawBlock("typst", '\n\n'))
  return result
end

-- Render a figure in the margin using marginalia's notefigure
function make_typst_margin_figure(tbl)
  local content = tbl.content or pandoc.Div({})
  local caption = tbl.caption
  local caption_location = tbl.caption_location or "bottom"
  local identifier = tbl.identifier
  local shift = tbl.shift or "auto"
  local alignment = tbl.alignment or "baseline"
  local dy = tbl.dy or "0pt"
  local kind = tbl.kind or "quarto-float-fig"
  local supplement = tbl.supplement or "Figure"

  local result = pandoc.Blocks({})

  -- Start notefigure call with parameters
  -- Include kind and supplement to share counter with regular figures
  result:insert(pandoc.RawBlock("typst",
    '#notefigure(alignment: "' .. alignment .. '", dy: ' .. dy ..
    ', shift: ' .. _quarto.format.typst.format_shift_param(shift) .. ', counter: none' ..
    ', kind: "' .. kind .. '", supplement: "' .. supplement .. '", '))

  -- Add figure content
  result:insert(pandoc.RawBlock("typst", '['))
  -- Listings should not be centered inside the figure
  if kind:match("lst") then
    result:insert(pandoc.RawBlock("typst", '#set align(left)'))
  end
  result:extend(quarto.utils.as_blocks(content))
  result:insert(pandoc.RawBlock("typst", ']'))

  -- Add caption if present, with position control
  if caption and not quarto.utils.is_empty_node(caption) then
    result:insert(pandoc.RawBlock("typst", ', caption: figure.caption(position: ' .. caption_location .. ', ['))
    if pandoc.utils.type(caption) == "Blocks" then
      result:extend(caption)
    else
      result:insert(caption)
    end
    result:insert(pandoc.RawBlock("typst", '])'))
  end

  -- Close notefigure
  result:insert(pandoc.RawBlock("typst", ')'))

  -- Add label for cross-references
  if identifier and identifier ~= "" then
    result:insert(pandoc.RawBlock("typst", '<' .. identifier .. '>'))
  end

  result:insert(pandoc.RawBlock("typst", '\n\n'))
  return result
end

-- Render a figure in main column with caption in margin
-- Uses marginalia's recommended show-rule approach for proper top-alignment
function make_typst_margin_caption_figure(tbl)
  local content = tbl.content or pandoc.Div({})
  local caption = tbl.caption
  local identifier = tbl.identifier
  local kind = tbl.kind or "quarto-float-fig"
  local supplement = tbl.supplement or "Figure"
  -- Margin captions align with top of content (consistent with HTML visual behavior)
  local alignment = tbl.alignment or "top"

  local result = pandoc.Blocks({})

  -- Use marginalia's recommended approach: show rule transforms figure.caption into margin note
  -- This ensures proper alignment because the caption anchors at the figure's position
  local cap_position = alignment == "top" and "top" or "bottom"
  local dy = alignment == "top" and "-0.01pt" or "0pt"

  -- Scoped show rule: transform figure captions into margin notes
  result:insert(pandoc.RawBlock("typst", '#['))
  result:insert(pandoc.RawBlock("typst", '#set figure(gap: 0pt)'))
  result:insert(pandoc.RawBlock("typst", '#set figure.caption(position: ' .. cap_position .. ')'))
  result:insert(pandoc.RawBlock("typst",
    '#show figure.caption: it => note(alignment: "' .. alignment .. '", dy: ' .. dy ..
    ', counter: none, shift: "avoid", keep-order: true)[#text(size: 0.9em)[#it]]'))

  -- Render figure WITH caption - the show rule transforms it into a margin note
  -- Typst's figure.caption already includes "Figure N:" prefix, so just include caption text
  result:insert(pandoc.RawBlock("typst", '#figure(['))
  -- Listings should not be centered inside the figure
  if kind:match("lst") then
    result:insert(pandoc.RawBlock("typst", '#set align(left)'))
  end
  result:extend(quarto.utils.as_blocks(content))
  result:insert(pandoc.RawBlock("typst", '], caption: ['))
  if caption and not quarto.utils.is_empty_node(caption) then
    if pandoc.utils.type(caption) == "Blocks" then
      result:extend(caption)
    else
      result:insert(caption)
    end
  end
  result:insert(pandoc.RawBlock("typst",
    '], kind: "' .. kind .. '", supplement: "' .. supplement .. '")'))

  -- Add label for cross-references
  if identifier and identifier ~= "" then
    result:insert(pandoc.RawBlock("typst", '<' .. identifier .. '>'))
  end

  -- Close scoping block
  result:insert(pandoc.RawBlock("typst", ']'))

  result:insert(pandoc.RawBlock("typst", '\n\n'))
  return result
end

function make_typst_figure(tbl)
  local content = tbl.content or pandoc.Div({})
  local caption_location = tbl.caption_location
  local caption = tbl.caption or pandoc.Div({})
  local kind = tbl.kind
  local supplement = tbl.supplement
  local numbering = tbl.numbering
  local identifier = tbl.identifier
  local separator = tbl.separator

  if quarto.utils.is_empty_node(caption) and tbl.separator == nil then
    separator = ""
  end

  local result =  pandoc.Blocks({
    pandoc.RawInline("typst", "#figure([")
  })
  result:extend(quarto.utils.as_blocks(content))
  result:extend({
    pandoc.RawInline("typst", "], caption: figure.caption("),
    pandoc.RawInline("typst", separator and ("separator: \"" .. separator .. "\", ") or ""),
    pandoc.RawInline("typst", "position: " .. caption_location .. ", "),
    pandoc.RawInline("typst", "["),
    caption or pandoc.Inlines({}),
    -- apparently typst doesn't allow separate prefix and name
    pandoc.RawInline("typst", "]), "),
    pandoc.RawInline("typst", "kind: \"" .. kind .. "\", "),
    pandoc.RawInline("typst", supplement and ("supplement: \"" .. supplement .. "\", ") or ""),
    -- For callouts, use callout-numbering variable defined in template
    -- (simple "1" for articles, chapter-based "1.1" with appendix support for books)
    pandoc.RawInline("typst", (kind and kind:find("^quarto%-callout%-")) and
      "numbering: callout-numbering, " or
      (numbering and ("numbering: \"" .. numbering .. "\", ") or "")),
    pandoc.RawInline("typst", ")"),
    pandoc.RawInline("typst", identifier and ("<" .. identifier .. ">") or ""),
    pandoc.RawInline("typst", "\n\n")
  })
  return result
end

local function render_floatless_typst_layout(panel)
  local result = pandoc.Blocks({})
  if panel.preamble then
    result:insert(panel.preamble)
  end

  -- render a grid per row of the layout
  -- https://typst.app/docs/reference/layout/grid/

  for i, row in ipairs(panel.layout) do
    -- synthesize column spec from row
    local col_spec = {}
    for j, col in ipairs(row) do
      table.insert(col_spec, col.attributes["width"])
    end
    -- TODO allow configurable gutter
    local col_spec_str = "columns: (" .. table.concat(col_spec, ", ") .. "), gutter: 1em, rows: 1,"
    result:insert(pandoc.RawBlock("typst", "#grid("))
    result:insert(pandoc.RawBlock("typst", col_spec_str))
    for j, col in ipairs(row) do
      result:insert(pandoc.RawBlock("typst", "  rect(stroke: none, width: 100%)["))
      -- #7718: if content is a single image with no attributes,
      --   we need to set the width to 100% to avoid Pandoc from
      --   specifying a width in pixels, which overrides the
      --   column's relative constraint.
      local image = quarto.utils.match("[1]/Para/[1]/{Image}")(col.content)

      -- we also need to check for Pandoc Figure AST nodes because these
      -- still linger in our AST (captioned unidentified figures...)
      image = image or quarto.utils.match("[1]/Figure/[1]/Plain/[1]/{Image}")(col.content)

      if image and #image[1].attributes == 0 then
        image[1].attributes["width"] = "100%"
      end
      result:extend(col.content)
      result:insert(pandoc.RawBlock("typst", "],"))
    end
    result:insert(pandoc.RawBlock("typst", ")\n"))
  end
  return result
end

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isTypstOutput()
end, function(layout)
  if layout.float == nil then
    return render_floatless_typst_layout(layout)
  end

  local ref = ref_type_from_float(layout.float)
  local kind = "quarto-float-" .. ref
  local info = crossref.categories.by_ref_type[ref]
  if info == nil then
    -- luacov: disable
    warning("Unknown float type: " .. ref .. "\n Will emit without crossref information.")
    return float.content
    -- luacov: enable
  end
  local supplement = titleString(ref, info.name)

  -- typst output currently only supports a single grid
  -- as output, so no rows of varying columns, etc.
  local n_cols = layout.attributes[kLayoutNcol] or "1"
  local result = pandoc.Blocks({})
  if layout.preamble then
    if pandoc.utils.type(layout.preamble) == "Blocks" then
      result:extend(layout.preamble)
    else
      result:insert(layout.preamble)
    end
  end
  local caption_location = cap_location(layout.float)

  local cells = pandoc.Blocks({})
  cells:insert(pandoc.RawInline("typst", "#grid(columns: " .. n_cols .. ", gutter: 2em,\n"))
  layout.rows.content:map(function(row)
    -- print(row)
    return row.content:map(function(cell)
      cells:insert(pandoc.RawInline("typst", "  ["))
      cells:insert(cell)
      cells:insert(pandoc.RawInline("typst", "],\n"))
    end)
  end)
  cells:insert(pandoc.RawInline("typst", ")\n"))

  local has_subfloats = layout.float.has_subfloats
  -- count any remaining figures (with no / bad ids) as floats
  if not has_subfloats then
    _quarto.ast.walk(layout.float.content, {
      Figure = function(figure)
        has_subfloats = true
      end
    })
  end

  -- Check if this is a margin panel (has .column-margin or .aside class)
  local is_margin = hasMarginColumn(layout.float)

  if has_subfloats then
    -- subrefnumbering defaults to subfloat-numbering in quarto_super
    -- (simple "1a" for articles, chapter-based "1.1a" for books)
    local super_call = _quarto.format.typst.function_call("quarto_super", {
      {"kind", kind},
      {"caption", _quarto.format.typst.as_typst_content(layout.float.caption_long)},
      {"label", pandoc.RawInline("typst", "<" .. layout.float.identifier .. ">")},
      {"position", pandoc.RawInline("typst", caption_location)},
      {"supplement", supplement},
      {"subcapnumbering", "(a)"},
      _quarto.format.typst.as_typst_content(cells)
    }, false)
    if is_margin then
      -- Wrap quarto_super in note() for margin placement
      -- counter: none disables the note marker (blue dot)
      local shift = layout.float.attributes and layout.float.attributes["shift"] or "auto"
      local alignment = layout.float.attributes and layout.float.attributes["alignment"] or "baseline"
      local dy = layout.float.attributes and layout.float.attributes["dy"] or "0pt"
      result:insert(pandoc.RawBlock("typst",
        '#note(counter: none, alignment: "' .. alignment .. '", dy: ' .. dy ..
        ', shift: ' .. _quarto.format.typst.format_shift_param(shift) .. ')['))
      result:insert(super_call)
      result:insert(pandoc.RawBlock("typst", ']\n\n'))
    else
      result:insert(super_call)
    end
  else
    if is_margin then
      result:extend(make_typst_margin_figure {
        content = cells,
        caption = layout.float.caption_long,
        caption_location = caption_location,
        identifier = layout.float.identifier,
        shift = layout.float.attributes and layout.float.attributes["shift"] or "auto",
        alignment = layout.float.attributes and layout.float.attributes["alignment"] or "baseline",
        dy = layout.float.attributes and layout.float.attributes["dy"] or "0pt",
        kind = kind,
        supplement = supplement
      })
    else
      result:extend(make_typst_figure {
        content = cells,
        caption_location = caption_location,
        caption = layout.float.caption_long,
        kind = kind,
        supplement = titleString(ref, info.prefix),
        numbering = info.numbering,
        identifier = layout.float.identifier
      })
    end
  end
  return result
end)
