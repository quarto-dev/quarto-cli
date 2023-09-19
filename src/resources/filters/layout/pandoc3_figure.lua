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
    return {
      traverse = "topdown",
      FloatRefTarget = function(float)
        local count = 0
        _quarto.ast.walk(float.content, {
          Figure = function()
            count = count + 1
          end
        })
        if count > 0 then
          return nil, false
        end
      end,
      Figure = function(figure)
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
        image.classes:extend(figure.classes)
        return latexImageFigure(image)
      end
    }
  end
  return {}
end
