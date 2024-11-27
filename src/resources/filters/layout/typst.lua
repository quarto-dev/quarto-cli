-- typst.lua
-- Copyright (C) 2023 Posit Software, PBC

function make_typst_figure(tbl)
  local content = tbl.content or pandoc.Div({})
  local caption_location = tbl.caption_location
  local caption = tbl.caption or pandoc.Div({})
  local kind = tbl.kind
  local supplement = tbl.supplement
  local numbering = tbl.numbering
  local identifier = tbl.identifier
  local separator = tbl.separator

  if (not caption or #caption.content == 0) and tbl.separator == nil then
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
    pandoc.RawInline("typst", numbering and ("numbering: \"" .. numbering .. "\", ") or ""),
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
  if has_subfloats then
    result:insert(_quarto.format.typst.function_call("quarto_super", {
      {"kind", kind},
      {"caption", _quarto.format.typst.as_typst_content(layout.float.caption_long)},
      {"label", pandoc.RawInline("typst", "<" .. layout.float.identifier .. ">")},
      {"position", pandoc.RawInline("typst", caption_location)},
      {"supplement", supplement},
      {"subrefnumbering", "1a"},
      {"subcapnumbering", "(a)"},
      _quarto.format.typst.as_typst_content(cells)
    }, false))
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
  return result
end)
