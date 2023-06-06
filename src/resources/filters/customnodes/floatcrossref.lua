-- crossreffloat.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "FloatCrossref",

  -- generic names this custom AST node responds to
  -- this is still unimplemented
  generics = {"Crossref"},

  -- float crossrefs are always blocks
  kind = "Block",

  parse = function(div)
    fail("FloatCrossref nodes should not be parsed")
  end,

  slots = { "content", "caption_long", "caption_short" },

  constructor = function(tbl)
    return tbl
  end
})

local function get_node_from_float_and_type(float, type)
  -- this explicit check appears necessary for the case where
  -- float.content is directly the node we want, and not a container that
  -- contains the node.
  if float.content.t == type then
    return float.content
  else
    local found_node = nil
    float.content:walk({
      traverse = "topdown",
      [type] = function(node)
        found_node = node
        return nil, false -- don't recurse
      end
    })
    return node
  end 
end

-- default renderer first
_quarto.ast.add_renderer("FloatCrossref", function(_)
  return true
end, function(float)
  quarto.utils.dump { float = float }
  return pandoc.Div({
    pandoc.Str("This is a placeholder FloatCrossref")
  })
end)

local function prepare_caption(float)
  if float.parent_id then
    prependSubrefNumber(float.caption_long, float.order)
  else
    local title_prefix = float_title_prefix(float)
    if pandoc.utils.type(float.caption_long) == "Blocks" then
      tprepend(float.caption_long, title_prefix)
    else
      tprepend(float.caption_long.content, title_prefix)
    end
  end
end

-- capture relevant figure attributes then strip them
local function get_figure_attributes(el)
  local align = figAlignAttribute(el)
  local keys = tkeys(el.attr.attributes)
  for _,k in pairs(keys) do
    if isFigAttribute(k) then
      el.attr.attributes[k] = nil
    end
  end
  local figureAttr = {}
  local style = el.attr.attributes["style"]
  if style then
    figureAttr["style"] = style
    el.attributes["style"] = nil
  end
  return {
    align = align,
    figureAttr = figureAttr
  }
end

_quarto.ast.add_renderer("FloatCrossref", function(_)
  return _quarto.format.isHtmlOutput()
end, function(float)
  prepare_caption(float)

  ------------------------------------------------------------------------------------
  -- Special handling for tables

  -- if we have a Table AST element, then we forward the caption
  -- into the node and display only that.
  local found_table = get_node_from_float_and_type(float, "Table")
  if found_table then
    -- in HTML, we insert the float caption directly in the table
    -- and render that as the result
    local div = pandoc.Div({found_table})
    div.attr = pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {})
    return div
  end

  ------------------------------------------------------------------------------------

  local caption_content = {
    pandoc.RawInline("html", "<figcaption>"),
    float.caption_long,
    pandoc.RawInline("html", "</figcaption>")
  }
  local float_prefix = refType(float.identifier)
  local caption_location = capLocation(float_prefix, 'bottom')
  if caption_location ~= "top" and caption_location ~= "bottom" then
    -- FIXME MARGIN
    error("Invalid caption location for float: " .. float.identifier .. " requested " .. caption_location .. ".\nOnly 'top' and 'bottom' are supported. Assuming 'bottom'.")
    
    caption_location = "bottom"
  end

  -- otherwise, we render the float as a div with the caption
  local div = pandoc.Div({})

  local found_image = get_node_from_float_and_type(float, "Image") or pandoc.Div({})
  local figure_attrs = get_figure_attributes(found_image)
  
  div.attr = merge_attrs(pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {}),
                         pandoc.Attr("", {}, figure_attrs.figureAttr))

  -- apply standalone figure css
  div.attr.classes:insert("quarto-figure")
  div.attr.classes:insert("quarto-figure-" .. figure_attrs.align)

  -- also forward any column or caption classes
  local currentClasses = found_image.attr.classes
  for _,k in pairs(currentClasses) do
    if isCaptionClass(k) or isColumnClass(k) then
      div.attr.classes:insert(k)
    end
  end

  div.content:insert(pandoc.RawBlock("html", "<figure>"))
  if caption_location == 'top' then
    div.content:extend(caption_content)
  end
  -- strip image captions
  local fixed_content = _quarto.ast.walk(float.content, {
    Image = function(image)
      image.caption = {}
      return image
    end
  })
  if fixed_content == nil then
    fail("Internal error: should never have arrived here")
    return
  end
  div.content:insert(pandoc.Para(fixed_content.content))
  if caption_location == 'bottom' then
    div.content:extend(caption_content)
  end
  div.content:insert(pandoc.RawBlock("html", "</figure>"))
  return div
end)