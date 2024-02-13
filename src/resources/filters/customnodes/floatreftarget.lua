-- floatreftarget.lua
-- Copyright (C) 2023 Posit Software, PBC

local drop_class = require("modules/filters").drop_class
local patterns = require("modules/patterns")

local function split_longtable_start(content_str)
  -- we use a hack here to split the content into params and actual content
  -- see https://github.com/quarto-dev/quarto-cli/issues/7655#issuecomment-1821181132

  -- we need to find a matching pair of braces
  -- we do this by counting the number of open braces
  
  -- we need to do this through utf8 because lua strings are not unicode-aware
  local codepoints = table.pack(utf8.codepoint(content_str, 1, #content_str))
  local function find_codepoint(start_idx, ...)
    if start_idx > #codepoints then
      return nil
    end
    local target_codepoints = table.pack(...)
    for i = start_idx, #codepoints do
      local code_point = codepoints[i]
      for _, target_codepoint in ipairs(target_codepoints) do
        if code_point == target_codepoint then
          return i, code_point
        end
      end
    end
    return nil
  end
  local function find_pair_of_braces(start_idx)
    local count = 0
    local open_brace_idx
    local next_brace_idx, code_point
    next_brace_idx = find_codepoint(start_idx, 123) -- {
    if next_brace_idx == nil then
      return nil
    end
    open_brace_idx = next_brace_idx
    next_brace_idx = next_brace_idx + 1
    count = count + 1
    while count > 0 do
      next_brace_idx, code_point = find_codepoint(next_brace_idx, 123, 125) -- {, }
      if next_brace_idx == nil then
        return nil
      end
      if code_point == 123 then
        count = count + 1
      else
        count = count - 1
      end
      next_brace_idx = next_brace_idx + 1
    end
    return open_brace_idx, next_brace_idx - 1
  end
  -- first find the start of the environment
  local start_idx, end_idx = find_pair_of_braces(1)
  if start_idx == nil then
    return nil
  end
  -- then find the start of the longtable params
  start_idx, end_idx = find_pair_of_braces(end_idx + 1)
  if start_idx == nil then
    return nil
  end
  -- now split the string
  return content_str:sub(1, end_idx), content_str:sub(end_idx + 1)
end


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
  if ref == nil or crossref.categories.by_ref_type[ref] == nil then
    ref = "fig"
  end
  local qualified_key = ref .. '-cap-location'
  local result = (
    float_or_layout.attributes[qualified_key] or
    float_or_layout.attributes['cap-location'] or
    option_as_string(qualified_key) or
    option_as_string('cap-location') or
    crossref.categories.by_ref_type[ref].caption_location)

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

-- we need to expose this function for use in the docusaurus renderer
quarto.doc.crossref.cap_location = cap_location

local function get_node_from_float_and_type(float, type, filter_base)
  -- this explicit check appears necessary for the case where
  -- float.content is directly the node we want, and not a container that
  -- contains the node.
  if float.content.t == type then
    return float.content
  else
    local found_node = nil
    local filter = {
      traverse = "topdown",
      [type] = function(node)
        found_node = node
        return nil, false -- don't recurse
      end
    }
    if filter_base ~= nil then
      for k,v in pairs(filter_base) do
        filter[k] = v
      end
    end
    _quarto.ast.walk(float.content, filter)
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

-- we need to expose this function for use in the docusaurus renderer,
-- which is technically an extension that doesn't have access to the
-- internal filters namespace
quarto.doc.crossref.decorate_caption_with_crossref = decorate_caption_with_crossref

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

  if float.content == nil then
    warn("FloatRefTarget with no content: " .. float.identifier)
    return pandoc.Div({})
  end

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
      if float.content.content == nil then
        -- it's a block that doesn't support inner content
        -- attempt a best-effort fix by replacing it with a wrapping div
        float.content = pandoc.Div({float.content})
      end
      float.content.content:insert(1, caption_setup)
    elseif pt == "Blocks" then
      float.content:insert(1, caption_setup)
    else
      internal_error()
    end
  end

  local label_cmd = quarto.LatexInlineCommand({
    name = "label",
    arg = pandoc.RawInline("latex", float.identifier)
  })
  latex_caption:insert(1, label_cmd)
  local latex_caption_content = latex_caption

  latex_caption = quarto.LatexInlineCommand({
    name = caption_cmd_name,
    opt_arg = fig_scap,
    arg = pandoc.Span(quarto.utils.as_inlines(latex_caption_content or {}) or {}) -- unnecessary to do the "or {}" bit but the Lua analyzer doesn't know that
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

  -- we need Pandoc to render its table ahead of time in order to
  -- do the longtable fixups below
  float.content = _quarto.ast.walk(quarto.utils.as_blocks(float.content), {
    traverse = "topdown",
    Div = function(div)
      if div.classes:find_if(isStarEnv) then
        return _quarto.ast.walk(div, {
          Table = function(tbl)
            if float.type == "Table" then
              figEnv = "table*"
            else
              figEnv = "figure*"
            end
            local result = latexTabular(tbl)
            return result
          end
        }), false
      end
    end,
    Table = function(tbl)
      local cites = pandoc.List({})
      local guid_id = global_table_guid_id
      local uuid = "85b77c8a-261c-4f58-9b04-f21c67e0a758"
      tbl = _quarto.ast.walk(tbl, {
        Cite = function(cite)
          cites:insert(cite)
          guid_id = guid_id + 1
          -- this uuid is created a little strangely here
          -- to ensure that no generated uuid will be a prefix of another,
          -- which would cause our regex replacement to pick up the wrong
          -- uuid
          return pandoc.Str(uuid .. "-" .. guid_id .. "-" .. uuid)
        end
      })
      local raw_output = pandoc.RawBlock("latex", pandoc.write(pandoc.Pandoc({tbl}), "latex"))
      if #cites > 0 then
        local local_guid_id = global_table_guid_id
        local result = pandoc.Blocks({
          make_scaffold(pandoc.Span, cites:map(function(cite)
            local_guid_id = local_guid_id + 1
            return make_scaffold(pandoc.Span, pandoc.Inlines({
              pandoc.RawInline("latex", "%quarto-define-uuid: " .. uuid .. "-" .. local_guid_id .. "-" .. uuid .. "\n"),
              cite,
              pandoc.RawInline("latex", "\n%quarto-end-define-uuid\n")
            }))
          end)), raw_output})
        global_table_guid_id = global_table_guid_id + #cites
        return result
      else
        return raw_output
      end
    end
  })

  if float_type == "tbl" then
    local made_fix = false
    local function fix_raw(is_star_env)
      local function set_raw(el)
        if _quarto.format.isRawLatex(el) and el.text:match(_quarto.patterns.latexLongtablePattern) then
          made_fix = true
          local raw = el
          -- special case for longtable floats in LaTeX
          local extended_pattern = "(.-)" .. _quarto.patterns.latexLongtablePattern .. "(.*)"
          local longtable_preamble, longtable_begin, longtable_content, longtable_end, longtable_postamble = raw.text:match(extended_pattern)
          if longtable_preamble == nil or longtable_begin == nil or longtable_content == nil or longtable_end == nil or longtable_postamble == nil then
            warn("Could not parse longtable parameters. This could happen because the longtable parameters\n" ..
            "are not well-formed or because of a bug in quarto. Please consider filing a bug report at\n" ..
            "https://github.com/quarto-dev/quarto-cli/issues/, and make sure to include the document that\n" ..
            "triggered this error.")
            return {}
          end
          -- split the content into params and actual content
          -- params are everything in the first line of longtable_content
          -- actual content is everything else
          local start, content = split_longtable_start(longtable_begin .. longtable_content)
          if start == nil or content == nil then
            warn("Could not parse longtable parameters. This could happen because the longtable parameters\n" ..
            "are not well-formed or because of a bug in quarto. Please consider filing a bug report at\n" ..
            "https://github.com/quarto-dev/quarto-cli/issues/, and make sure to include the document that\n" ..
            "triggered this error.")
            return {}
          end
          local cap_loc = cap_location(float)
          if float.parent_id then
            -- need to fixup subtables because longtables don't support subcaptions,
            -- and longtable captions increment the wrong counter
            -- we try our best here

            fatal("longtables are not supported in subtables.\n" ..
              "This is not a Quarto bug - the LaTeX longtable environment doesn't support subcaptions.\n")
            return {}
          end
          if is_star_env then
            -- content: table payload
            -- start: \\begin{longtable}... command
            -- longtable_preamble: everything that came before the \\begin{longtable} command
            -- longtable_postamble: everything that came after the \\end{longtable} command
            local result = pandoc.Blocks({
              pandoc.RawBlock("latex", longtable_preamble),
              pandoc.RawBlock("latex", "\\begin{table*}"),
              -- caption here if cap_loc == "top"
              pandoc.RawBlock("latex", start .. "\n" .. content .. "\n\\end{longtable}"),
              -- caption here if cap_loc ~= "top"
              pandoc.RawBlock("latex", "\\end{table*}"),
              pandoc.RawBlock("latex", longtable_postamble),
            })
            if cap_loc == "top" then
              result:insert(3, latex_caption)
              -- gets around the padding that longtable* adds
              result:insert(4, pandoc.RawBlock("latex", "\\vspace{-1em}"))
            else
              result:insert(4, latex_caption)
            end
            return result
          else
            local result = pandoc.Blocks({latex_caption, pandoc.RawInline("latex", "\\tabularnewline")})
            -- if cap_loc is top, insert content on bottom
            if cap_loc == "top" then
              result:insert(pandoc.RawBlock("latex", content))        
            else
              result:insert(1, pandoc.RawBlock("latex", content))
            end
            result:insert(1, pandoc.RawBlock("latex", start))
            result:insert(1, pandoc.RawBlock("latex", longtable_preamble))
            result:insert(pandoc.RawBlock("latex", "\\end{longtable}"))
            result:insert(pandoc.RawBlock("latex", longtable_postamble))
            return result
          end
        end
      end
      return set_raw
    end
    -- have to call as_blocks() again here because assigning to float.content
    -- goes through our AST metaclasses which coalesce a singleton list to a single AST element
    local fixed_up_content = _quarto.ast.walk(quarto.utils.as_blocks(float.content), {
      traverse = "topdown",
      Div = function(div)
        if div.classes:find_if(isStarEnv) then
          return _quarto.ast.walk(div, {
            RawBlock = fix_raw(true)
          }), false
        end
      end,
      RawBlock = fix_raw(false)
    })
    if made_fix then
      return fixed_up_content
    end
  end

  -- As an additional complication, we need to handle the case where the
  -- content is a table* environment, by stripping the environment raw code
  -- and recreating it below.
  -- See #7937
  if _quarto.format.isRawLatex(float.content) then
    local _b, _e, _beginenv, inner_content, _endenv = float.content.text:find(patterns.latex_table_star)
    if _b ~= nil then 
      figEnv = "table*"
      float.content.text = inner_content
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
  assert(figure_content ~= nil)

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
        figure_content:insert(1, latex_caption) -- Since this is a side caption, insert it physically above the figure to improve typsetting
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
  local caption_location = cap_location(float)

  -- use a uuid to ensure that the figcaption ids won't conflict with real
  -- ids in the document
  local caption_id = float.identifier .. "-caption-" .. figcaption_uuid
  
  local classes = { }
  table.insert(classes, "quarto-float-caption-" .. caption_location)

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
  }), caption_id, caption_location
end

function float_reftarget_render_html_figure(float)
  float = ensure_custom(float)
  if float == nil then
    -- luacov: disable
    internal_error()
    return pandoc.Div({})
    -- luacov: enable
  end

  local caption_content, caption_id, caption_location = create_figcaption(float)
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

  local found_image = pandoc.Div({})
  -- #7727: don't recurse into tables when searching for a figure from
  -- which to get attributes
  if float.content.t ~= "Table" then
    found_image = get_node_from_float_and_type(float, "Image", {
      Table = function(table)
        return nil, false
      end,
    }) or pandoc.Div({})
  end
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
  div.attr.classes:insert("quarto-float")

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

  if float.type == "Table" and float.content.t == "Table" then
    -- special-case the situation where the figure is Table and the content is Table
    --
    -- just return the table itself with the caption inside the table
    float.content.caption.long = float.caption_long
    float.content.attr = pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {})
    return pandoc.Blocks({
      pandoc.RawBlock("asciidoc", "[[" .. float.identifier .. "]]\n"),
      float.content
    })
  end

  -- if this is a "linked figure Div", render it as such.
  local link = quarto.utils.match("Plain/[1]/{Link}/[1]/{Image}")(float.content)
  if link then
    link[2].identifier = float.identifier
    local caption = quarto.utils.as_inlines(float.caption_long)
    table.insert(caption, 1, pandoc.RawInline("asciidoc", "."))
    table.insert(caption, pandoc.RawInline("asciidoc", "\n[[" .. float.identifier .. "]]\n"))
    table.insert(caption, link[1])
    return caption
  end

  -- if the float consists of exactly one image,
  -- render it as a pandoc Figure node.
  local count = 0
  local img
  _quarto.ast.walk(float.content, {
    Image = function(node)
      count = count + 1
      img = node
    end
  })
  if count == 1 then
    print(float.content)
    img.identifier = float.identifier
    img.caption = quarto.utils.as_inlines(float.caption_long)
    return pandoc.Figure(
      {img},
      {float.caption_long},
      float.identifier)
  end

  -- Fallthrough case, render into a div.
  float.caption_long.content:insert(1, pandoc.RawInline("asciidoc", "."))
  float.caption_long.content:insert(pandoc.RawInline("asciidoc", "\n[[" .. float.identifier .. "]]\n===="))

  if pandoc.utils.type(float.content) == "Blocks" then
    float.content:insert(1, float.caption_long)
    float.content:insert(pandoc.RawBlock("asciidoc", "====\n"))
    return float.content
  else
    return pandoc.Blocks({
      float.caption_long,
      -- pandoc.RawBlock("asciidoc", "[[" .. float.identifier .. "]]\n====\n"),
      float.content,
      pandoc.RawBlock("asciidoc", "====\n\n")
    })
  end

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
  local content = float.content

  if float.parent_id then
    kind = "quarto-subfloat-" .. ref
    numbering = "(a)"
  else
    kind = "quarto-float-" .. ref
    numbering = "1"
    supplement = info.name
  end

  local caption_location = cap_location(float)

  -- FIXME: custom numbering doesn't work yet
  
  if (ref == "lst") then
    -- FIXME: 
    -- Listings shouldn't emit centered blocks. 
    -- We don't know how to disable that right now using #show rules for #figures in template.
    content = { pandoc.RawBlock("typst", "#set align(left)"), content }
  end

  return make_typst_figure {
    content = content,
    caption_location = caption_location,
    caption = float.caption_long,
    kind = kind,
    supplement = supplement,
    numbering = numbering,
    identifier = float.identifier
  }
end)

global_table_guid_id = 0