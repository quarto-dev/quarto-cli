-- typst.lua
-- Copyright (C) 2023 Posit Software, PBC


_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isTypstOutput()
end, function(layout)
  if layout.float == nil then
    fail_and_ask_for_bug_report("PanelLayout renderer requires a float in typst output")
    return pandoc.Div({})
  end

  local ref = refType(layout.float.identifier)
  local info = crossref.categories.by_ref_type[ref]
  if info == nil then
    -- luacov: disable
    warning("Unknown float type: " .. ref .. "\n Will emit without crossref information.")
    return float.content
    -- luacov: enable
  end

  local typst_figure_content = pandoc.Div({})
  typst_figure_content.content:insert(pandoc.RawInline("typst", "#grid(columns: 3, gutter: 2em,\n"))
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
  result:extend({
    pandoc.RawInline("typst", "\n\n#figure(["),
    typst_figure_content,
    pandoc.RawInline("typst", "], caption: ["),
    layout.float.caption_long,
    -- apparently typst doesn't allow separate prefix and name
    pandoc.RawInline("typst", "], kind: \"quarto-" .. ref .. "\", supplement: \"" .. info.prefix .. "\""),

    pandoc.RawInline("typst", ")<" .. layout.float.identifier .. ">\n\n")
  })
  return result
end)
