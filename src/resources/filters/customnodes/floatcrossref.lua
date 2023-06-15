-- crossreffloat.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "FloatCrossref",

  -- generic names this custom AST node responds to
  -- this is still unimplemented
  interfaces = {"Crossref"},

  -- float crossrefs are always blocks
  kind = "Block",

  parse = function(div)
    fail("FloatCrossref nodes should not be parsed")
  end,

  slots = { "content", "caption_long", "caption_short" },

  constructor = function(tbl)
    if tbl.attr then
      tbl.identifier = tbl.attr.identifier
      tbl.classes = tbl.attr.classes
      tbl.attributes = as_plain_table(tbl.attr.attributes)
      tbl.attr = nil
    end
    return tbl
  end
})

function cap_location(float)
  local float_prefix = refType(float.identifier)
  local qualified_key = float_prefix .. '-cap-location'
  local result = (
    float.attributes[qualified_key] or
    float.attributes['cap-location'] or
    option_as_string(qualified_key) or
    option_as_string('cap-location') or
    capLocation(float_prefix) or
    crossref.categories.by_prefix[float_prefix].default_caption_location)

  if result ~= "margin" and result ~= "top" and result ~= "bottom" then
    error("Invalid caption location for float: " .. float.identifier .. 
      " requested " .. result .. 
      ".\nOnly 'top', 'bottom', and 'margin' are supported. Assuming 'bottom'.")
    result = "bottom"
  end
    
  return result
end

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
    return found_node
  end
end

-- default renderer first
_quarto.ast.add_renderer("FloatCrossref", function(_)
  return true
end, function(float)
  return pandoc.Div({
    pandoc.Str("This is a placeholder FloatCrossref")
  })
end)

local function ensure_custom(node)
  if pandoc.utils.type(node) == "Block" or pandoc.utils.type(node) == "Inline" then
    return _quarto.ast.resolve_custom_data(node)
  end
  return node
end

function prepare_caption(float)
  float = ensure_custom(float)
  -- this should never happen, but it appeases the Lua analyzer
  if float == nil then
    return
  end
  local caption_content = float.caption_long.content or float.caption_long

  if float.parent_id then
    prependSubrefNumber(caption_content, float.order)
  else
    local title_prefix = float_title_prefix(float)
    tprepend(caption_content, title_prefix)
  end
  return float
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
  return true
end, function(float)
  return float.content
end)

_quarto.ast.add_renderer("FloatCrossref", function(_)
  return _quarto.format.isHtmlOutput()
end, function(float)
  prepare_caption(float)

  ------------------------------------------------------------------------------------
  -- Special handling for tables

  -- -- if we have a Table AST element, then we forward the caption
  -- -- into the node and display only that.
  -- local found_table = get_node_from_float_and_type(float, "Table")
  -- if found_table then
  --   -- in HTML, we insert the float caption directly in the table
  --   -- and render that as the result
  --   found_table.caption.long = float.caption_long
  --   local div = pandoc.Div({ 
  --     pandoc.RawBlock("html", "<figure>"),
  --     found_table,
  --     pandoc.RawBlock("html", "</figure>"),
  --    })
  --   div.attr = pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {})
  --   return div
  -- end

  ------------------------------------------------------------------------------------
  -- Special handling for listings
  local found_listing = get_node_from_float_and_type(float, "CodeBlock")
  if found_listing then
    found_listing.attr = merge_attrs(found_listing.attr, pandoc.Attr("", float.classes or {}, float.attributes or {}))
    -- FIXME this seems to be necessary for our postprocessor to kick in
    -- check this out later
    found_listing.identifier = float.identifier
  end

  ------------------------------------------------------------------------------------
  
  return float_crossref_render_html_figure(float)
end)

local figcaption_uuid = "0ceaefa1-69ba-4598-a22c-09a6ac19f8ca"

local function create_figcaption(float)
  -- use a uuid to ensure that the figcaption ids won't conflict with real
  -- ids in the document
  local caption_id = float.identifier .. "-caption-" .. figcaption_uuid
  local caption_content = pandoc.Plain({})
  local class = "figure-caption"
  if float.parent_id then
    class = "subfigure-caption"
  end
  caption_content.content:insert(
    pandoc.RawInline("html", 
      "<figcaption class='" .. class 
      .. "' id='" .. caption_id 
      .. "'>"))
  if #float.caption_long.content then
    caption_content.content:extend(float.caption_long.content)
  else
    caption_content.content:insert(float.caption_long)
  end
  caption_content.content:insert(pandoc.RawInline("html", "</figcaption>"))

  return quarto.HtmlTag({
    name = "figcaption",
    attr = pandoc.Attr(caption_id, {class}, {}),
    content = float.caption_long,
  }), caption_id
  -- return caption_content, caption_id
end

function float_crossref_render_html_figure(float)
  float = ensure_custom(float)
  if float == nil then
    fail("Should never happen")
    return pandoc.Div({})
  end

  local caption_content, caption_id = create_figcaption(float)
  local caption_location = cap_location(float)

  local float_content = pandoc.Div(_quarto.ast.walk(float.content, {
    -- strip image captions
    Image = function(image)
      image.caption = {}
      return image
    end
  }) or pandoc.Div({})) -- this should never happen but the lua analyzer doesn't know it
  float_content.attributes["aria-describedby"] = caption_id

  -- otherwise, we render the float as a div with the caption
  local div = pandoc.Div({})

  local found_image = get_node_from_float_and_type(float, "Image") or pandoc.Div({})
  local figure_attrs = get_figure_attributes(found_image)
  
  div.attr = merge_attrs(
    pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {}),
    pandoc.Attr("", {}, figure_attrs.figureAttr))
  -- FIXME consider making the CSS classes uniform
  if float.type == "Listing" then
    div.attr.classes:insert("listing")
  elseif float.type == "Figure" then
    -- apply standalone figure css
    div.attr.classes:insert("quarto-figure")
    div.attr.classes:insert("quarto-figure-" .. figure_attrs.align)
  else
    -- FIXME work more generally here.
  end

  -- also forward any column or caption classes
  local currentClasses = found_image.attr.classes
  for _,k in pairs(currentClasses) do
    if isCaptionClass(k) or isColumnClass(k) then
      div.attr.classes:insert(k)
    end
  end

  local float_prefix = refType(float.identifier)
  local figure_class = "quarto-float-" .. float_prefix
  div.content:insert(pandoc.RawBlock("html", "<figure class='" .. figure_class .. "'>"))
  if caption_location == 'top' then
    div.content:insert(caption_content)
  end
  div.content:insert(float_content)
  if caption_location == 'bottom' or caption_location == 'margin' then
    div.content:insert(caption_content)
  end
  div.content:insert(pandoc.RawBlock("html", "</figure>"))

  return div
end