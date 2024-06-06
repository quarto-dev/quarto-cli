-- pandoc3_figure.lua
-- Copyright (C) 2023 Posit Software, PBC

-- Figure nodes (from Pandoc3) can exist in our AST. They're
-- never cross-referenceable but they need to be rendered as 
-- if they were.

local scope_utils = require("modules/scope")

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
    local result = htmlImageFigure(image)
    -- preserve the figure identifier in the case of non-FloatRefTarget Figure nodes
    -- https://github.com/quarto-dev/quarto-cli/issues/9631
    result.identifier = figure.identifier
    return result
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
    local function is_inside_float(scope)
      for i = #scope, 1, -1 do
        local s = scope[i]
        local data = _quarto.ast.resolve_custom_data(s)
        if data then
          if (data.t == "PanelLayout" and data.is_float_reftarget == true) then 
            return true
          elseif (data.t == "FloatRefTarget") then
            return true
          end
        end
      end
    end
    local function is_subfig(scope)
      for i = #scope, 1, -1 do
        local s = scope[i]
        local data = _quarto.ast.resolve_custom_data(s)
        if data and (data.t == "PanelLayout") then 
          return true
        end
      end

      return false
    end

    local function figure_renderer(figure, scope)
      if is_inside_float(scope) then
        return nil, false
      end
      local subfig = is_subfig(scope)
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
      if subfig then
        image.attributes['quarto-caption-env'] = 'subcaption'
      end
      image.classes:extend(figure.classes)
      if scope_utils.lookup_class(scope, "column-margin") then
        image.classes:insert("column-margin")
      end
      return latexImageFigure(image)
    end

    local filter = {
      Figure = function(figure, scope)
        return figure_renderer(figure, scope), false
      end
    }
    return {
      Pandoc = function(doc)
        _quarto.ast.scoped_walk(doc.blocks, filter)
      end
    }
  elseif _quarto.format.isTypstOutput() then
    return {
      traverse = "topdown",
      Figure = function(figure)
        return make_typst_figure({
          content = figure.content[1],
          caption = figure.caption.long[1],
          kind = "quarto-float-fig",
          caption_location = crossref.categories.by_ref_type["fig"].caption_location,
          supplement = titleString('fig', 'Figure'),
        })
      end
    }
  end
  return {}
end
