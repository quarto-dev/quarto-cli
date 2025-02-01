-- html.lua
-- Copyright (C) 2023 Posit Software, PBC

function render_html_fixups()
  if not _quarto.format.isHtmlOutput() then 
    return {} 
  end
  local function needs_forward_align(source)
    return attribute(source, kFigAlign, nil) or source.classes:find_if(function(c) return c:match("quarto%-figure.*") end)
  end
  local function forward_align(source, target)
    local align = attribute(source, kFigAlign, nil)
    if align ~= nil then
      target.classes:insert("quarto-figure")
      target.classes:insert("quarto-figure-" .. align)
    end
    for i, c in ipairs(source.classes) do
      if c:match("quarto%-figure.*") then
        target.classes:insert(c)
      end
    end
  end

  return {
    Table = function(tbl)
      -- Add back classes 'odd', (or 'header' in table header) / 'even' to table rows
      -- They were removed in pandoc 3.2.1 but are useful for styling pandoc processed tables
      -- Quarto detects .odd class 
      local function add_odd_even (rows, odd)
        odd = odd or 'odd'
        for rownum, row in ipairs(rows) do
          row.classes:insert((rownum % 2) == 0 and 'even' or odd)
        end
        return rows
      end
      add_odd_even(tbl.head.rows, 'header')
      for _, tblbody in ipairs(tbl.bodies) do
        add_odd_even(tblbody.body)
      end
      add_odd_even(tbl.foot.rows)

      -- this requires bootstrap CSS
      if quarto.doc.crossref.cap_location(tbl) == "top" then
        tbl.classes:insert("caption-top")
      end
      
      return tbl
    end,
    Figure = function(fig)
      if #fig.content ~= 1 then
        return nil
      end
      local img = quarto.utils.match("Figure/[1]/Plain/[1]/Image")(fig) or quarto.utils.match("Figure/[1]/Plain/[1]/Link/[1]/Image")(fig)
      if not img then
        return nil
      end
      if not needs_forward_align(img) then
        return nil
      end
      forward_align(img, fig)
      return fig
    end,
    Image = function(el)
      -- FIXME we're not validating here, but we can't use figAlignAttribute because
      -- it picks up the default value from the document metadata, which is not
      -- what we want here.
      local align = attribute(el, kFigAlign, nil)
      if align ~= nil then
        el.attributes[kFigAlign] = nil
        el.classes:insert("quarto-figure")
        el.classes:insert("quarto-figure-" .. align)
      end
      local alt_text = attribute(el, kFigAlt, nil)
      if alt_text ~= nil then
        el.attributes["alt"] = alt_text
        el.attributes[kFigAlt] = nil
      end
      return el
    end,
    Para = function(para)
      if #para.content ~= 1 then
        return nil
      end
      local img = quarto.utils.match("Para/[1]/Image")(para) or quarto.utils.match("Para/[1]/Link/[1]/Image")(para)
      if not img then
        return nil
      end
      if not needs_forward_align(img) then
        return nil
      end
      local el = pandoc.Div({
        pandoc.RawBlock("html", "<figure>"),
        para,
        pandoc.RawBlock("html", "</figure>")
      })

      forward_align(img, el)
      return el
    end,
    Div = function(div)
      -- this narrow fix prevents a 1.3 regression with knitr:
      -- https://github.com/quarto-dev/quarto-cli/issues/7516
      -- 
      -- if we have a cell-output-display with a para with an image, we want to
      -- wrap the paragraph in a <figure> rawblock so that our CSS works compatibly with the
      -- CSS we use for FloatRefTargets

      local lst = quarto.utils.match(".cell-output-display/:child/{Para}/:child/{Image}")(div)
      -- ideally, we'd do the lightbox processing after this fixup, but ordering matters,
      -- so we need to check for a potential output of the lightbox filter here
      if not lst or #lst == 0 then
        lst = quarto.utils.match(".cell-output-display/:child/{Para}/:child/Link/:child/{Image}")(div)
      end
      if not lst or #lst == 0 then
        return
      end
      local para = lst[1]
      local img = lst[2]
      -- we still need to find the correct index in the parent content
      for i, node in ipairs(div.content) do
        if node == para then
          local el = pandoc.Div({
            pandoc.RawBlock("html", "<figure>"),
            para,
            pandoc.RawBlock("html", "</figure>")
          })
          div.content[i] = el
          -- the image here might have been changed by the filter above already,
          -- but I don't trust this order to be consistent, so here we check
          -- for both attribute and class

          forward_align(img, el)
          return div
        end
      end
    end
  }
end