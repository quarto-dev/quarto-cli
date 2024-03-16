-- pandoc3_figure.lua
-- Copyright (C) 2023 Posit Software, PBC

-- Figure nodes (from Pandoc3) can exist in our AST. They're
-- never cross-referenceable but they need to be rendered as 
-- if they were.

function render_pandoc3_figure()
  local function html_handle_linked_image(figure)
    local div = pandoc.Div({})
    div.identifier = "fig-yesiamafigure" -- this is a bad hack to make discoverLinkedFigureDiv work
    local link = nil
    if figure.content[1].t == "Plain" then
      local plain = figure.content[1]
      if plain.content[1].t == "Link" then
        link = plain.content[1]
      end
    end
    if link == nil then
      return nil
    end
    div.content:insert(pandoc.Para({link}))
    local pt = pandoc.utils.type(figure.caption.long)
    if pt == "Blocks" or pt == "Inlines" then
      div.content:insert(pandoc.Para(quarto.utils.as_inlines(figure.caption.long)))
    elseif pt == "Inline" or pt == "Block" then
      div.content:insert(pandoc.Para({figure.caption.long}))
    else
      internal_error()
    end
    local image = discoverLinkedFigureDiv(div)
    if image == nil then
      return nil
    end
    div.identifier = ""
    div.classes:extend(figure.classes)
    return htmlDivFigure(div)
  end
  local function html_handle_image(figure)
    local image
    _quarto.ast.walk(figure, {
      Image = function(img)
        image = img
      end
    })
    if image == nil then
      return figure
    end
    if figure.caption.long ~= nil then
      image.caption = quarto.utils.as_inlines(figure.caption.long)
    end
    -- TODO need to find all correct classes to forward
    for i, v in pairs(figure.classes) do
      if v:match("^margin%-") or v:match("^quarto%-") or v:match("^column%-") then
        image.classes:insert(v)
      end
    end
    return htmlImageFigure(image)
  end

  if _quarto.format.isHtmlOutput() then
    return {
      traverse = "topdown",
      Figure = function(figure)
        local result = html_handle_linked_image(figure)
        if result ~= nil then
          return result
        end
        return html_handle_image(figure)
      end
    }
  elseif _quarto.format.isLatexOutput() then
    -- split local declaration because Lua's local is not
    -- a letrec
    local filter
    filter = function(state)
      state = state or {}
      local function figure_renderer(figure, is_subfig)
        -- this is a figure that is not cross-referenceable
        -- if this ends up in a layout without fig-pos = H, it'll fail
        -- 'H' forces it to not float
        if figure.identifier == "" then
          figure = _quarto.ast.walk(figure, {
            Image = function(image)
              image.attributes['fig-pos'] = 'H'
              return image
            end
          })
        end
        local image
        _quarto.ast.walk(figure, {
          Image = function(img)
            image = img
          end
        })
        if image == nil then
          return figure
        end
        if figure.caption.long ~= nil then
          image.caption = quarto.utils.as_inlines(figure.caption.long)
        end
        for k, v in pairs(figure.attributes) do
          image.attributes[k] = v
        end
        if is_subfig then
          image.attributes['quarto-caption-env'] = 'subcaption'
        end
        image.classes:extend(figure.classes)
        if state.in_column_margin then
          image.classes:insert("column-margin")
        end
        return latexImageFigure(image)
      end
      local function float_renderer(float)
        local count = 0
        local new_content = _quarto.ast.walk(float.content, {
          Figure = function(fig)
            count = count + 1
            return figure_renderer(fig, true), false
          end
        })
        if count > 0 then
          float.content = new_content
          return float, false
        end
      end
      return {
        traverse = "topdown",
        PanelLayout = function(panel)
          panel.rows = _quarto.ast.walk(panel.rows, {
            Figure = function(fig)
              return figure_renderer(fig, true), false
            end
          })
          return panel, false
        end,
        FloatRefTarget = float_renderer,
        Div = function(div)
          if div.classes:includes("column-margin") then
            local new_state = {}
            for k, v in pairs(state) do
              new_state[k] = v
            end
            new_state.in_column_margin = true
            
            div.content = _quarto.ast.walk(div.content, filter(new_state))
            div.classes = div.classes:filter(function(x) return x ~= "column-margin" end)
            return div
          end
        end,
        Figure = function(figure)
          return figure_renderer(figure, false)
        end
      }
    end
    return filter()
  elseif _quarto.format.isTypstOutput() then
    return {
      traverse = "topdown",
      Figure = function(figure)
        return make_typst_figure({
          content = figure.content[1],
          caption = figure.caption.long[1],
          kind = "quarto-float-fig",
          caption_location = crossref.categories.by_ref_type["fig"].caption_location,
          supplement = "Figure",
        })
      end
    }
  end
  return {}
end
