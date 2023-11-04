-- floatreftarget.lua
-- Copyright (C) 2023 Posit Software, PBC

local drop_class = require("modules/filters").drop_class

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "FloatRefTarget",

  -- generic names this custom AST node responds to
  -- this is still unimplemented
  interfaces = {"Crossref"},

  -- float reftargets are always blocks
  kind = "Block",

  parse = function(div)
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end,

  slots = { "content", "caption_long", "caption_short" },

  constructor = function(tbl)
    if tbl.attr then
      tbl.identifier = tbl.attr.identifier
      tbl.classes = tbl.attr.classes
      tbl.attributes = as_plain_table(tbl.attr.attributes)
      tbl.attr = nil
    end

    tbl.attributes = pandoc.List(tbl.attributes)
    tbl.classes = pandoc.List(tbl.classes)

    table_colwidth_cell(tbl) -- table colwidth forwarding
    return tbl
  end
})

function cap_location(float_or_layout)
  local ref = refType(float_or_layout.identifier)
  -- layouts might not have good identifiers, but they might have
  -- ref-parents
  if ref == nil then
    ref = refType(float_or_layout.attributes["ref-parent"] or "")
  end
  -- last resort, pretend we're a figure
  if ref == nil then
    ref = "fig"
  end
  local qualified_key = ref .. '-cap-location'
  local result = (
    float_or_layout.attributes[qualified_key] or
    float_or_layout.attributes['cap-location'] or
    option_as_string(qualified_key) or
    option_as_string('cap-location') or
    crossref.categories.by_ref_type[ref].default_caption_location)

  if result ~= "margin" and result ~= "top" and result ~= "bottom" then
    -- luacov: disable
    error("Invalid caption location for float: " .. float_or_layout.identifier .. 
      " requested " .. result .. 
      ".\nOnly 'top', 'bottom', and 'margin' are supported. Assuming 'bottom'.")
    result = "bottom"
    -- luacov: enable
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
_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return true
end, function(float)
  warn("\nEmitting a placeholder FloatRefTarget\nOutput format " .. FORMAT .. " does not currently support FloatRefTarget nodes.")
  return scaffold(float.content)
end)

function is_unlabeled_float(float)
  -- from src/resources/filters/common/refs.lua
  return float.identifier:match("^%a+%-539a35d47e664c97a50115a146a7f1bd%-")
end

function decorate_caption_with_crossref(float)
  if not param("enable-crossref", true) then
    -- don't decorate captions with crossrefs information if crossrefs are disabled
    return float
  end
  float = ensure_custom(float)
  -- nil should never happen here, but the Lua analyzer doesn't know it
  if float == nil then
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end
  local caption_content = float.caption_long.content or float.caption_long

  if float.parent_id then
    if float.order == nil then
      warn("Subfloat without crossref information")
    else
      prependSubrefNumber(caption_content, float.order)
    end
  else
    -- in HTML, unlabeled floats do not get a title prefix
    if (not is_unlabeled_float(float)) then
      local is_uncaptioned = not ((caption_content ~= nil) and (#caption_content > 0))
      -- this is a hack but we need it to control styling downstream
      float.is_uncaptioned = is_uncaptioned
      local title_prefix = float_title_prefix(float, not is_uncaptioned)
      tprepend(caption_content, title_prefix)
    end
  end
  return float
end

function full_caption_prefix(float, subfloat)
  if not param("enable-crossref", true) then
    -- don't decorate captions with crossrefs information if crossrefs are disabled
    return {}
  end

  float = ensure_custom(float)
  -- nil should never happen here, but the Lua analyzer doesn't know it
  if float == nil then
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end  

  if subfloat ~= nil then
    subfloat = ensure_custom(subfloat)
    -- nil should never happen here, but the Lua analyzer doesn't know it
    if subfloat == nil then
      -- luacov: disable
      internal_error()
      -- luacov: enable
    end  
  end

  local float_title = {}
  if not is_unlabeled_float(float) then
    float_title = float_title_prefix(float, false)
  end

  local subfloat_title = pandoc.Inlines({})
  if subfloat ~= nil then
    if subfloat.order == nil then
      warn("Subfloat without crossref information")
    else
      prependSubrefNumber(subfloat_title, subfloat.order)
    end
  end
  if #subfloat_title > 0 then
    tappend(float_title,{nbspString()})
  end
  tappend(float_title, subfloat_title)
  tappend(float_title, titleDelim())
  tappend(float_title, {pandoc.Space()})
  return pandoc.Inlines(float_title)
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

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isLatexOutput()
end, function(float)
  local figEnv = latexFigureEnv(float)
  local figPos = latexFigurePosition(float, figEnv)
  local float_type = refType(float.identifier)

  local capLoc = cap_location(float)
  local caption_cmd_name = latexCaptionEnv(float)

  if float.parent_id then
    if caption_cmd_name == kSideCaptionEnv then
      fail_and_ask_for_bugreport("Subcaptions for side captions are unimplemented.")
      return {}
    end
    caption_cmd_name = "subcaption"
  elseif float.content.t == "Table" and float_type == "tbl" then -- float.parent_id is nil here
    -- special-case the situation where the figure is Table and the content is Table
    --
    -- just return the table itself with the caption inside the table

    -- FIXME how about tables in margin figures?

    caption_cmd_name = "caption"
    float.content.caption.long = float.caption_long
    float.content.attr = pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {})
    return float.content
  end

  local fig_scap = attribute(float, kFigScap, nil)
  if fig_scap then
    fig_scap = pandoc.Span(markdownToInlines(fig_scap))
  end

  local latex_caption
  if float.caption_long and type(float.caption_long) ~= "table" then
    latex_caption = quarto.utils.as_inlines(float.caption_long)
  else
    latex_caption = float.caption_long
  end

  if #latex_caption == 0 then
    local caption_setup = quarto.LatexInlineCommand({
      name = "captionsetup",
      arg = "labelsep=none"
    })
    local pt = pandoc.utils.type(float.content)
    if pt == "Block" then
      float.content.content:insert(1, caption_setup)
    elseif pt == "Blocks" then
      float.content:insert(1, caption_setup)
    else
      internal_error()
    end
  end

  local label_cmd = quarto.LatexInlineCommand({
    name = "label",
    arg = pandoc.Str(float.identifier)
  })
  latex_caption:insert(1, label_cmd)
  latex_caption = quarto.LatexInlineCommand({
    name = caption_cmd_name,
    opt_arg = fig_scap,
    arg = pandoc.Span(quarto.utils.as_inlines(latex_caption or {}) or {}) -- unnecessary to do the "or {}" bit but the Lua analyzer doesn't know that
  })

  if float.parent_id then
    -- need to fixup subtables because nested longtables appear to give latex fits
    local vAlign = validatedVAlign(float.attributes[kLayoutVAlign])
    local function handle_table(tbl)
      return latexTabular(tbl, vAlign)
    end
    if float.content.t == "Table" then
      float.content = handle_table(float.content)
    else
      float.content = _quarto.ast.walk(float.content, {
        Table = handle_table
      }) or pandoc.Div({}) -- unnecessary to do the "or {}" bit but the Lua analyzer doesn't know that
    end
  end

  local figure_content
  local pt = pandoc.utils.type(float.content)
  if pt == "Block" then
    figure_content = pandoc.Blocks({ float.content })
  elseif pt == "Blocks" then
    figure_content = float.content
  else
    -- luacov: disable
    fail_and_ask_for_bug_report("Unexpected type for float content: " .. pt)
    return {}
    -- luacov: enable
  end

  -- align the figure
  local align = figAlignAttribute(float)
  if align == "center" then
    figure_content = pandoc.Blocks({
      quarto.LatexBlockCommand({
        name = "centering",
        inside = true,
        arg = scaffold(figure_content)
      })
    })
  elseif align == "right" then
    figure_content:insert(1, quarto.LatexInlineCommand({
      name = "hfill",
    }))
  end -- otherwise, do nothing
  -- figure_content:insert(1, pandoc.RawInline("latex", latexBeginAlign(align)))
  -- figure_content:insert(pandoc.RawInline("latex", latexEndAlign(align)))

  if latex_caption then
    if caption_cmd_name == kSideCaptionEnv then
      if #figure_content > 1 then
        figure_content:insert(2, latex_caption) -- FIXME why is this 2 and not 1?
      else
        figure_content:insert(latex_caption)
      end
    elseif capLoc == "top" then
      figure_content:insert(1, latex_caption)
    else
      figure_content:insert(latex_caption)
    end
  end

  if float.parent_id then
    -- the environment here is handled by the parent float and
    -- the panel layout code
    return figure_content
  else
    return quarto.LatexEnvironment({
      name = figEnv,
      pos = figPos,
      content = _quarto.ast.walk(figure_content, {
        Image = drop_class("column-margin")
      })
    })
  end
end)

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isHtmlOutput()
end, function(float)
  decorate_caption_with_crossref(float)

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
  
  return float_reftarget_render_html_figure(float)
end)

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isDocxOutput() or _quarto.format.isOdtOutput()
end, function(float)
  -- docx format requires us to annotate the caption prefix explicitly
  decorate_caption_with_crossref(float)

  -- options
  local options = {
    pageWidth = wpPageWidth(),
  }

  -- determine divCaption handler (always left-align)
  local divCaption = nil
  if _quarto.format.isDocxOutput() then
    divCaption = docxDivCaption
  elseif _quarto.format.isOdtOutput() then
    divCaption = odtDivCaption
  else
    -- luacov: disable
    internal_error()
    return
    -- luacov: enable
  end

  options.divCaption = function(el, align) return divCaption(el, "left") end

  -- get alignment
  local align = align_attribute(float)
  
  -- create the row/cell for the figure
  local row = pandoc.List()
  local cell = pandoc.Div({})
  cell.attr = pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {})
  local c = float.content.content or float.content
  if pandoc.utils.type(c) == "Block" then
    cell.content:insert(c)
  elseif pandoc.utils.type(c) == "Blocks" then
    cell.content = c
  elseif pandoc.utils.type(c) == "Inlines" then
    cell.content:insert(pandoc.Plain(c))
  end
  transfer_float_image_width_to_cell(float, cell)
  row:insert(cell)

  -- handle caption
  local new_caption = options.divCaption(float.caption_long, align)
  local caption_location = cap_location(float)
  if caption_location == 'top' then
    cell.content:insert(1, new_caption)
  else
    cell.content:insert(new_caption)
  end

  -- content fixups for docx, based on old docx.lua code
  cell = docx_content_fixups(cell, align)

  -- make the table
  local figureTable = pandoc.SimpleTable(
    pandoc.List(), -- caption
    { layoutTableAlign(align) },  
    {   1   },         -- full width
    pandoc.List(), -- no headers
    { row }            -- figure
  )
  
  -- return it
  return pandoc.utils.from_simple_table(figureTable)
end)

local figcaption_uuid = "0ceaefa1-69ba-4598-a22c-09a6ac19f8ca"

local function create_figcaption(float)
  local cap = float.caption_long
  if float.caption_long == nil or pandoc.utils.stringify(float.caption_long) == "" then
    cap = pandoc.Blocks({})
  end
    local ref_type = refType(float.identifier)
  -- use a uuid to ensure that the figcaption ids won't conflict with real
  -- ids in the document
  local caption_id = float.identifier .. "-caption-" .. figcaption_uuid
  local classes = { float.type:lower() }
  if float.parent_id then
    table.insert(classes, "quarto-subfloat-caption")
    table.insert(classes, "quarto-subfloat-" .. ref_type)
  else
    table.insert(classes, "quarto-float-caption")
    table.insert(classes, "quarto-float-" .. ref_type)
  end
  if float.is_uncaptioned then
    -- this figcaption will only contain the crossreferenceable label
    table.insert(classes, "quarto-uncaptioned")
  end
  return quarto.HtmlTag({
    name = "figcaption",
    attr = pandoc.Attr(caption_id, classes, {}),
    content = float.caption_long,
  }), caption_id
end

function float_reftarget_render_html_figure(float)
  float = ensure_custom(float)
  if float == nil then
    -- luacov: disable
    internal_error()
    return pandoc.Div({})
    -- luacov: enable
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
  if caption_id ~= nil then
    float_content.attributes["aria-describedby"] = caption_id
  end

  -- otherwise, we render the float as a div with the caption
  local div = pandoc.Div({})

  local found_image = get_node_from_float_and_type(float, "Image") or pandoc.Div({})
  local figure_attrs = get_figure_attributes(found_image)
  
  div.attr = merge_attrs(
    pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {}),
    pandoc.Attr("", {}, figure_attrs.figureAttr))
  if float.type == "Listing" then
    div.attr.classes:insert("listing")
  elseif float.type == "Figure" then
    -- apply standalone figure css
    div.attr.classes:insert("quarto-figure")
    div.attr.classes:insert("quarto-figure-" .. figure_attrs.align)
  end

  -- also forward any column or caption classes
  local currentClasses = found_image.attr.classes
  for _,k in pairs(currentClasses) do
    if isCaptionClass(k) or isColumnClass(k) then
      div.attr.classes:insert(k)
    end
  end

  local ref = refType(float.identifier)
  local figure_class
  if float.parent_id then
    figure_class = "quarto-subfloat-" .. ref
  else
    figure_class = "quarto-float-" .. ref
  end

  -- Notice that we need to insert the figure_div value
  -- into the div, but we need to use figure_tbl
  -- to manipulate the contents of the custom node. 
  --
  -- This is because the figure_div is a pandoc.Div (required to
  -- be inserted into pandoc divs), but figure_tbl is
  -- the lua table with the metatable required to marshal
  -- the inner contents of the custom node.
  --
  -- This is relatively ugly, and another instance
  -- of the impedance mismatch we have in the custom AST
  -- API. 
  -- 
  -- it's possible that the better API is for custom constructors
  -- to always return a Lua object and then have a separate
  -- function to convert that to a pandoc AST node.
  local figure_div, figure_tbl = quarto.HtmlTag({
    name = "figure",
    attr = pandoc.Attr("", {"quarto-float", figure_class}, {}),
  })
  
  figure_tbl.content.content:insert(float_content)
  if caption_content ~= nil then
    if caption_location == 'top' then
      figure_tbl.content.content:insert(1, caption_content)
    else
      figure_tbl.content.content:insert(caption_content)
    end
  end
  div.content:insert(figure_div)
  return div
end

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isAsciiDocOutput()
end, function(float)
  if float.content.t == "Plain" and #float.content.content == 1 and float.content.content[1].t == "Image" then
    return pandoc.Figure(
      {float.content},
      {float.caption_long},
      float.identifier)
  end

  float.caption_long.content:insert(1, pandoc.RawInline("asciidoc", ". "))
  float.caption_long.content:insert(pandoc.RawInline("asciidoc", "\n[[" .. float.identifier .. "]]\n===="))
  return pandoc.Div({
    float.caption_long,
    -- pandoc.RawBlock("asciidoc", "[[" .. float.identifier .. "]]\n====\n"),
    float.content,
    pandoc.RawBlock("asciidoc", "====\n\n")
  })

end)

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isJatsOutput()
end, function(float)
  -- don't emit unlabeled floats in JATS
  if is_unlabeled_float(float) then
    float.identifier = ""
  end
  decorate_caption_with_crossref(float)
  return pandoc.Figure(
    {float.content},
    {float.caption_long},
    float.identifier
  )
end)

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isIpynbOutput() and param("enable-crossref", true)
end, function(float)
  decorate_caption_with_crossref(float)
  if float.content.t == "Plain" and #float.content.content == 1 and float.content.content[1].t == "Image" then
    return pandoc.Figure(
      {float.content},
      {float.caption_long},
      float.identifier)
  end

  return pandoc.Div({
    float.content,
    pandoc.Para(quarto.utils.as_inlines(float.caption_long) or {}),
  });
end)

-- this should really be "_quarto.format.isEmbedIpynb()" or something like that..
_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isIpynbOutput() and not param("enable-crossref", true)
end, function(float)
  if float.content.t == "Plain" and #float.content.content == 1 and float.content.content[1].t == "Image" then
    local imgEl = float.content.content[1]
    if not float.in_code_cell_output then
      imgEl.identifier = float.identifier
      imgEl.caption =  quarto.utils.as_inlines(float.caption_long) or {}
    end
    return pandoc.Para({imgEl})
  elseif float.in_code_cell_output then
    -- If the float is in a code_cell_output, it is ok to drop the identifier
    -- and caption, because that infdormation is still carried by the cell itself
    return float.content
  else
    -- TODO: Need to deal with other cases, such as flextable, which results in a 
    -- Table which contains a FloatRefTarget (with an image/figure) inside of it.
    return float.content
  end
end)

_quarto.ast.add_renderer("FloatRefTarget", function(_)
  return _quarto.format.isTypstOutput()
end, function(float)
  local ref = refType(float.identifier)
  local info = crossref.categories.by_ref_type[ref]
  if info == nil then
    -- luacov: disable
    warning("Unknown float type: " .. ref .. "\n Will emit without crossref information.")
    return float.content
    -- luacov: enable
  end
  local kind
  local supplement = ""
  local numbering = ""

  if float.parent_id then
    kind = "quarto-subfloat-" .. ref
    numbering = "(a)"
  else
    kind = "quarto-float-" .. ref
    numbering = "1"
    supplement = info.name
  end

  local caption_location = cap_location(float)

  -- FIXME: Listings shouldn't emit centered blocks. I don't know how to disable that right now.
  -- FIXME: custom numbering doesn't work yet

  return make_typst_figure {
    content = float.content,
    caption_location = caption_location,
    caption = float.caption_long,
    kind = kind,
    supplement = supplement,
    numbering = numbering,
    identifier = float.identifier
  }
end)