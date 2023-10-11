-- typst.lua
-- Copyright (C) 2023 Posit Software, PBC

function make_typst_figure(tbl)
  local content = tbl.content
  local caption_location = tbl.caption_location
  local caption = tbl.caption
  local kind = tbl.kind
  local supplement = tbl.supplement
  local numbering = tbl.numbering
  local identifier = tbl.identifier
  local separator = tbl.separator

  if #caption.content == 0 and tbl.separator == nil then
    separator = ""
  end

  return pandoc.Blocks({
    pandoc.RawInline("typst", "#figure(["),
    content,
    pandoc.RawInline("typst", "], caption: figure.caption("),
    pandoc.RawInline("typst", separator and ("separator: \"" .. separator .. "\", ") or ""),
    pandoc.RawInline("typst", "position: " .. caption_location .. ", "),
    pandoc.RawInline("typst", "["),
    caption,
    -- apparently typst doesn't allow separate prefix and name
    pandoc.RawInline("typst", "]), "),
    pandoc.RawInline("typst", "kind: \"" .. kind .. "\", "),
    pandoc.RawInline("typst", supplement and ("supplement: \"" .. supplement .. "\", ") or ""),
    pandoc.RawInline("typst", numbering and ("numbering: \"" .. numbering .. "\", ") or ""),
    pandoc.RawInline("typst", ")"),
    pandoc.RawInline("typst", identifier and ("<" .. identifier .. ">") or ""),
    pandoc.RawInline("typst", "\n\n")
  })
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

  local ref = refType(layout.float.identifier)
  local kind = "quarto-float-" .. ref
  local info = crossref.categories.by_ref_type[ref]
  if info == nil then
    -- luacov: disable
    warning("Unknown float type: " .. ref .. "\n Will emit without crossref information.")
    return float.content
    -- luacov: enable
  end

  -- typst output currently only supports a single grid
  -- as output, so no rows of varying columns, etc.
  local n_cols = layout.attributes[kLayoutNcol] or "1"

  local typst_figure_content = pandoc.Div({})
  typst_figure_content.content:insert(pandoc.RawInline("typst", "#grid(columns: " .. n_cols .. ", gutter: 2em,\n"))
  local is_first = true
  _quarto.ast.walk(layout.float.content, {
    FloatRefTarget = function(_, float_obj)
      if is_first then
        is_first = false
      else
        typst_figure_content.content:insert(pandoc.RawInline("typst", ",\n"))
      end
      typst_figure_content.content:insert(pandoc.RawInline("typst", "  ["))
      typst_figure_content.content:insert(float_obj)
      typst_figure_content.content:insert(pandoc.RawInline("typst", "]"))
      return nil
    end
  })
  typst_figure_content.content:insert(pandoc.RawInline("typst", ")\n"))
  local result = pandoc.Blocks({})
  if layout.preamble then
    result:insert(layout.preamble)
  end
  local caption_location = cap_location(layout.float)

  return make_typst_figure {
    content = typst_figure_content,
    caption_location = caption_location,
    caption = layout.float.caption_long,
    kind = kind,
    supplement = info.prefix,
    numbering = info.numbering,
    identifier = layout.float.identifier
  }
  -- result:extend({
  --   pandoc.RawInline("typst", "\n\n#figure(["),
  --   typst_figure_content,
  --   pandoc.RawInline("typst", "], caption: ["),
  --   layout.float.caption_long,
  --   -- apparently typst doesn't allow separate prefix and name
  --   pandoc.RawInline("typst", "], kind: \"" .. kind .. "\", supplement: \"" .. info.prefix .. "\""),
  --   pandoc.RawInline("typst", ", caption-pos: " .. caption_location),
  --   pandoc.RawInline("typst", ")<" .. layout.float.identifier .. ">\n\n")
  -- })
  -- return result
end)
