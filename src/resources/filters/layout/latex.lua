-- latex.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
kSideCaptionEnv = 'sidecaption'

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isLatexOutput()
end, function(layout)
  local rendered_panel = latexPanel(layout)
  local preamble = layout.preamble
  if preamble == nil then
    return rendered_panel
  end
  
  local result = pandoc.Blocks({})
  panel_insert_preamble(result, preamble)
  result:insert(rendered_panel)

  return result
end)

-- function latexPanel(divEl, layout, caption)
function latexPanel(layout)
  
  -- begin container
  local env, pos = latexPanelEnv(layout)
  local panel_node, panel = quarto.LatexEnvironment({
    name = env,
    pos = pos
  })

  local capLoc = "bottom"

  if layout.float ~= nil then
    capLoc = cap_location(layout.float)
  end
  local caption = create_latex_caption(layout)
  
   -- read vertical alignment and strip attribute
  local vAlign = validatedVAlign(layout.attributes[kLayoutVAlign])
  layout.attributes[kLayoutVAlign] = nil

  for i, row in ipairs(layout.rows.content) do
    
    for j, cell in ipairs(row.content) do
      
      -- there should never be \begin{table} inside a panel (as that would 
      -- create a nested float). this can happen if knitr injected it as a 
      -- result of a captioned latex figure. in that case remove it
      cell = latexRemoveTableDelims(cell)
      
      -- process cell (enclose content w/ alignment)
      local endOfTable = i == #layout.rows.content
      local endOfRow = j == #row.content
      local prefix, content, suffix = latexCell(cell, vAlign, endOfRow, endOfTable)
      panel.content.content:insert(prefix)
      tappend(panel.content.content, content)
      panel.content.content:insert(suffix)
    end
    
  end
  
  -- surround caption w/ appropriate latex (and end the panel)
  if caption then
    if capLoc == "top" then
      panel.content.content:insert(1, caption)
    elseif capLoc == "bottom" then
      panel.content.content:insert(caption)
    else
      warn("unknown caption location '" .. capLoc .. "'. Skipping caption.")
    end
  end
  -- conjoin paragraphs 
  panel.content.content = latexJoinParas(panel.content.content)

  -- return panel
  return panel_node
end

-- determine the environment (and pos) to use for a latex panel
function latexPanelEnv(layout)
  
  -- defaults
  local env = latexFigureEnv(layout)
  local pos = attribute(layout.float or { attributes = {} }, kFigPos)
  
  return env, pos
end

-- conjoin paragraphs (allows % to work correctly between minipages or subfloats)
function latexJoinParas(content)
  local blocks = pandoc.List()
  for i,block in ipairs(content) do
    if block.t == "Para" and #blocks > 0 and blocks[#blocks].t == "Para" then
      tappend(blocks[#blocks].content, block.content)
    else
      blocks:insert(block)
    end
  end
  return blocks
end

function latexCaptionEnv(el) 
  if el.classes:includes(kSideCaptionClass) then
    return kSideCaptionEnv
  else
    return 'caption'
  end
end

function create_latex_caption(layout)
  if layout.float == nil then
     return nil
  end
  local caption_env = latexCaptionEnv(layout.float)
  if ((layout.caption_long == nil or #layout.caption_long.content == 0) and
      (layout.caption_short == nil or #layout.caption_short.content == 0)) then
    return nil
  end
  local cap_inlines = quarto.utils.as_inlines(layout.caption_long) or pandoc.Inlines({}) -- unneeded but the Lua analyzer doesn't know that
  if layout.identifier then
    -- local label_node = quarto.LatexInlineCommand({ name = "label", arg = layout.identifier })
    local label_node = pandoc.RawInline("latex", "\\label{" .. layout.identifier .. "}")
    
    cap_inlines:insert(1, label_node)
  end
  local caption_node, caption = quarto.LatexInlineCommand({
    name = caption_env,
    arg = scaffold(cap_inlines),
  })
  if layout.caption_short ~= nil then
    caption.opt_arg = quarto.utils.as_inlines(layout.caption_short)
  end
  return caption_node
end

function latexWrapSignalPostProcessor(el, token) 
  -- this is a table div not in a panel note any caption environment
  tprepend(el.content, {pandoc.RawBlock('latex', '%quartopost-' .. token)});
  tappend(el.content, {pandoc.RawBlock('latex', '%/quartopost-' .. token)});
end

function latexMarkupCaptionEnv(el) 
  local captionEnv = latexCaptionEnv(el)
  if captionEnv == 'sidecaption' then
    latexWrapSignalPostProcessor(el, 'sidecaption-206BE349');
  end
end

        
function markupLatexCaption(el, caption, captionEnv)

  -- by default, just use the caption env
  if captionEnv == nil then
    captionEnv = 'caption'
  end

  local captionEnv = latexCaptionEnv(el)
  
  -- caption prefix (includes \\caption macro + optional [subcap] + {)
  local captionPrefix = pandoc.List({
    pandoc.RawInline("latex", "\\" .. captionEnv)
  })
  local figScap = attribute(el, kFigScap, nil)
  if figScap then
    captionPrefix:insert(pandoc.RawInline("latex", "["))
    tappend(captionPrefix, markdownToInlines(figScap))
    captionPrefix:insert(pandoc.RawInline("latex", "]"))
  end
  captionPrefix:insert(pandoc.RawInline("latex", "{"))
  tprepend(caption, captionPrefix)
  
  -- end the caption
  caption:insert(pandoc.RawInline("latex", "}"))
end

local kBeginSideNote = '\\marginnote{\\begin{footnotesize}'
function latexBeginSidenote(block) 
  if block == nil or block then
    return pandoc.RawBlock('latex', kBeginSideNote)
  else
    return pandoc.RawInline('latex', kBeginSideNote)
  end
end

local kEndSideNote = '\\end{footnotesize}}'
function latexEndSidenote(el, block)
  local offset = ''
  if el.attr ~= nil then
    local offsetValue = el.attributes['offset']
    if offsetValue ~= nil then
      offset = '[' .. offsetValue .. ']'
    end  
  end
  if block == nil or block then
    return pandoc.RawBlock('latex', kEndSideNote .. offset)
  else
    return pandoc.RawInline('latex', kEndSideNote .. offset)
  end
end

function latexWrapEnvironment(el, env, inline) 
  tprepend(el.content, {latexBeginEnv(env, nil, inline)})
  tappend(el.content, {latexEndEnv(env, inline)})
end

function latexBeginAlign(align)
  if align == "center" then
    return "{\\centering "
  elseif align == "right" then
    return "\\hfill{} "      
  else
    return ""
  end
end

function latexEndAlign(align)
  if align == "center" then
    return "\n\n}"
  elseif align == "left" then
    return " \\hfill{}"
  else
    return ""
  end
end

function latexBeginEnv(env, pos, inline)
  local beginEnv = "\\begin{" .. env .. "}"
  if pos then
    if not string.find(pos, "^[%[{]") then
      pos = "[" .. pos .. "]"
    end
    beginEnv = beginEnv .. pos
  end
  if inline then
    return pandoc.RawInline("latex", beginEnv)
  else
    return pandoc.RawBlock("latex-merge", beginEnv)
  end
end

function latexEndEnv(env, inline)
  if inline then
    return pandoc.RawInline("latex", "\\end{" .. env .. "}")
  else
    return pandoc.RawBlock("latex-merge", "\\end{" .. env .. "}%")
  end
end

function latexCell(cell, vAlign, endOfRow, endOfTable)

  -- figure out what we are dealing with
  local label = cell.identifier
  local image = figureImageFromLayoutCell(cell)
  local has_pandoc_3_figure = false
  if image == nil then
    -- attempt to unwrap a Pandoc Figure
    cell = _quarto.ast.walk(cell, {
      Figure = function(figure)
        has_pandoc_3_figure = true
        _quarto.ast.walk(figure, {
          Image = function(img)
            image = img
          end
        })
        if image ~= nil then
          return image
        end
      end
    })
  end
  if (label == "") and image then
    label = image.identifier
  end
  local isFigure = isFigureRef(label)
  local isTable = isTableRef(label)
  local isSubRef = hasRefParent(cell) or (image and hasRefParent(image)) or has_pandoc_3_figure
  local tbl = tableFromLayoutCell(cell)
  
  -- determine width 
  local width = cell.attributes["width"]
  
  -- derive prefix, content, and suffix
  local prefix = pandoc.List()
  local subcap = pandoc.List()
  local content = pandoc.List()
  local suffix = pandoc.List()

  if isSubRef then
    
    -- lift the caption out it it's current location and onto the \subfloat
    local caption = pandoc.List()
    
    -- see if it's a captioned figure
    if image and #image.caption > 0 then
      caption = image.caption:clone()
      tclear(image.caption)
    elseif tbl then
      caption = pandoc.utils.blocks_to_inlines(tbl.caption.long)
      tclear(tbl.caption.long)
      if tbl.caption.short then
        tclear(tbl.caption.short)
      end
      cell.content = { latexTabular(tbl, vAlign) }
    else
      local divCaption = refCaptionFromDiv(cell)
      if divCaption then
        caption = refCaptionFromDiv(cell).content
        cell.content = tslice(cell.content, 1, #cell.content-1)
      else
        caption = pandoc.List()
      end
    end

    -- only subcap in the passthrough Figure special case
    if has_pandoc_3_figure then
      -- subcap
      latexAppend(subcap, "\\subcaption{\\label{" .. label .. "}")
      tappend(subcap, caption)
      latexAppend(subcap, "}\n")
    end
  end

  
  -- convert to latex percent as necessary
  width = asLatexSize(width)

  -- start the minipage
  local miniPageVAlign = latexMinipageValign(vAlign)
  latexAppend(prefix, "\\begin{minipage}" .. miniPageVAlign .. "{" .. width .. "}\n")

  local capLoc = cap_location(cell)

  if (capLoc == "top") then
    tappend(prefix, subcap)
  end

  -- if we aren't in a sub-ref we may need to do some special work to
  -- ensure that captions are correctly emitted
  local cellOutput = false;
  if not isSubRef then
    if image and #image.caption > 0 then
      local caption = image.caption:clone()
      markupLatexCaption(cell, caption)
      tclear(image.caption)
      content:insert(pandoc.RawBlock("latex", "\\raisebox{-\\height}{"))
      content:insert(pandoc.Para(image))
      content:insert(pandoc.RawBlock("latex", "}"))
      content:insert(pandoc.Para(caption))
      cellOutput = true
    elseif isFigure then
      local caption = refCaptionFromDiv(cell).content
      markupLatexCaption(cell, caption)
      content:insert(pandoc.RawBlock("latex", "\\raisebox{-\\height}{"))
      tappend(content, tslice(cell.content, 1, #cell.content-1))
      content:insert(pandoc.RawBlock("latex", "}"))
      content:insert(pandoc.Para(caption)) 
      cellOutput = true
    end
  end
  
  -- if we didn't find a special case then just emit everything
  if not cellOutput then
    tappend(content, cell.content)

    -- vertically align the minipage
    if miniPageVAlign == "[t]" and image ~= nil then
      tprepend(content, { pandoc.RawBlock("latex", "\\raisebox{-\\height}{")})
      tappend(content, { pandoc.RawBlock("latex", "}") })
    end  
  end

  if (capLoc == "bottom") then
    tappend(suffix, subcap)
  end

  -- close the minipage
  latexAppend(suffix, "\\end{minipage}%")
  
  latexAppend(suffix, "\n")
  if not endOfRow then
    latexAppend(suffix, "%")
  elseif not endOfTable then
    latexAppend(suffix, "\\newline")
  end
  latexAppend(suffix, "\n")
  
  -- ensure that pandoc doesn't write any nested figures
  for i,block in ipairs(content) do
    latexHandsoffFigure(block)
    content[i] = _quarto.ast.walk(block, {
      Para = latexHandsoffFigure
    })
  end
  
  return pandoc.Para(prefix), content, pandoc.Para(suffix)
  
end

function latexTabular(tbl, vAlign)
  
  -- convert to simple table
  tbl = pandoc.utils.to_simple_table(tbl)
  
  -- list of inlines
  local tabular = pandoc.List()
  
  -- vertically align the minipage
  local tabularVAlign = latexMinipageValign(vAlign)
 
  -- caption
  if #tbl.caption > 0 then
    latexAppend(tabular, "\\caption{")
    tappend(tabular, tbl.caption)
    latexAppend(tabular, "}\n")
  end
  
  -- header
  local aligns = table.concat(tbl.aligns:map(latexTabularAlign), "")
  latexAppend(tabular, "\\begin{tabular}" .. tabularVAlign .. "{" .. aligns .. "}\n")
  latexAppend(tabular, "\\toprule\n")
  
  -- headers (optional)
  local headers = latexTabularRow(tbl.headers)
  if latexTabularRowHasContent(headers) then
    latexTabularRowAppend(tabular, headers)
    latexAppend(tabular, "\\midrule\n")
  end
  
  -- rows
  for _,row in ipairs(tbl.rows) do
    latexTabularRowAppend(tabular, latexTabularRow(row))
  end
  
  -- footer
  latexAppend(tabular, "\\bottomrule\n")
  latexAppend(tabular, "\\end{tabular}")
  
  -- return tabular
  return pandoc.Para(tabular)
  
end

function latexTabularRow(row)
  local cells = pandoc.List()
  for _,cell in ipairs(row) do
    cells:insert(pandoc.utils.blocks_to_inlines(cell))
  end
  return cells
end

function latexTabularRowHasContent(row)
  for _,cell in ipairs(row) do
    if #cell > 0 then
      return true
    end
  end
  return false
end

function latexTabularRowAppend(inlines, row)
  for i,cell in ipairs(row) do
    tappend(inlines, cell)
    if i < #row then
      latexAppend(inlines, " & ")
    end
  end
  latexAppend(inlines, "\\\\\n")
end

function latexTabularAlign(align)
  if align == pandoc.AlignLeft then
    return "l"
  elseif align == pandoc.AlignRight then
    return "r"
  elseif align == pandoc.AlignCenter then
    return "c"
  else
    return "l"
  end
end

function latexAppend(inlines, latex)
  inlines:insert(pandoc.RawInline("latex", latex))
end

function latexHandsoffFigure(el)
  if discoverFigure(el, false) ~= nil then
    el.content:insert(pandoc.RawInline("markdown", "<!-- -->"))
  end
end

function latexRemoveTableDelims(el)
  return _quarto.ast.walk(el, {
    RawBlock = function(el)
      if _quarto.format.isRawLatex(el) then
        el.text = el.text:gsub("\\begin{table}[^\n]*\n", "")
        el.text = el.text:gsub("\\end{table}[^\n]*\n?", "")
        return el
      end
    end
  })
end

local kMarginFigureEnv = "marginfigure"
local kOffset = "offset"

-- Computes the figure position for a figure environment
-- margin figures use offset instead of position
function latexFigurePosition(el, env) 
  if env == kMarginFigureEnv then
    return attribute(el, kOffset, nil)
  else
    local prefix = refType(el.identifier) or "fig"
    return attribute(el, prefix .. "-pos", nil)
  end
end

function latexFigureEnv(el) 
 -- Check whether the user has specified a figure environment
  local figEnv = attribute(el, kFigEnv, nil)
  if figEnv ~= nil then
    -- the user specified figure environment
    return figEnv
  else
    local crossref_cat
    if pandoc.utils.type(el) == "Block" then
      local ref_type = refType(el.identifier)
      if ref_type ~= nil then
        crossref_cat = crossref.categories.by_ref_type[ref_type]
      else
        crossref_cat = crossref.categories.by_name.Figure
      end
    elseif pandoc.utils.type(el) == "table" then
      crossref_cat = crossref.categories.by_name[el.type]
      if crossref_cat == nil then
        crossref_cat = crossref.categories.by_name.Figure
      end
    elseif pandoc.utils.type(el) == "Inline" then
      local ref_type = refType(el.identifier)
      if ref_type ~= nil then
        crossref_cat = crossref.categories.by_ref_type[ref_type]
      else
        crossref_cat = crossref.categories.by_name.Figure
      end
    else
      fail("Don't know how to handle " .. pandoc.utils.type(el) .. " in latexFigureEnv")
    end
    local env_name = crossref_cat.latex_env
    -- if not user specified, look for other classes which might determine environment
    local classes = el.classes
    for i,class in ipairs(classes) do

      -- FIXME how to deal with margin custom floats?
      -- a margin figure or aside
      if isMarginEnv(class) then 
        noteHasColumns()
        return kMarginFigureEnv
      end

      -- any column that resolves to full width
      if isStarEnv(class) then
        noteHasColumns()
        return env_name .. "*"
      end
    end  

    -- the default figure environment
    return env_name
  end
end

function latexOtherEnv(el)
    -- if not user specified, look for other classes which might determine environment
    local classes = el.classes
    if classes ~= nil then
      for i,class in ipairs(classes) do

        -- any column that resolves to full width
        if isStarEnv(class) then
          noteHasColumns()
          return "figure*"
        end
      end  
    end
    return nil
end

function latexTableEnv(el)
 
  local classes = el.classes
  for i,class in ipairs(classes) do

    -- a margin figure or aside
    if isMarginEnv(class) then 
      noteHasColumns()
      return "margintable"
    end

    -- any column that resolves to full width
    if isStarEnv(class) then
      noteHasColumns()
      return "table*"
    end
  end  

  -- the default figure environment
  return "table"
end

-- this is still used by stray Figure nodes from Pandoc 3's AST
function latexImageFigure(image)

  return renderLatexFigure(image, function(figure)
    
    -- make a copy of the caption and clear it
    local caption = image.caption:clone()
    tclear(image.caption)
    
    -- get align
    local align = figAlignAttribute(image)
    if align ~= nil then
      image.attributes[kFigAlign] = nil
    end
    -- insert the figure without the caption
    local figureContent = { pandoc.Para({
      pandoc.RawInline("latex", latexBeginAlign(align)),
      image,
      pandoc.RawInline("latex", latexEndAlign(align)),
      pandoc.RawInline("latex", "\n")
    }) }
    
    -- return the figure and caption
    return figureContent, caption
    
  end)
end

function renderLatexFigure(el, render)
  
  -- create container
  local figure = pandoc.Div({})

  -- begin the figure
  local figEnv = latexFigureEnv(el)
  local figPos = latexFigurePosition(el, figEnv)

  figure.content:insert(latexBeginEnv(figEnv, figPos))
  
  -- get the figure content and caption inlines
  local figureContent, captionInlines = render(figure)  

  local capLoc = cap_location_from_option("fig", "bottom")

  -- surround caption w/ appropriate latex (and end the figure)
  if captionInlines and inlinesToString(captionInlines) ~= "" then
    if capLoc == "top" then
      insertLatexCaption(el, figure.content, captionInlines)
      tappend(figure.content, figureContent)
    else
      tappend(figure.content, figureContent)
      insertLatexCaption(el, figure.content, captionInlines)
    end
  else
    tappend(figure.content, figureContent)
  end
  
  -- end figure
  figure.content:insert(latexEndEnv(figEnv))
  
  -- return the figure
  return figure
  
end

function latexCaptionEnv(el) 
  if el.classes:includes(kSideCaptionClass) then
    return kSideCaptionEnv
  else
    return 'caption'
  end
end

function insertLatexCaption(divEl, content, captionInlines) 
  local captionEnv = latexCaptionEnv(divEl)
  markupLatexCaption(divEl, captionInlines, captionEnv)
  if captionEnv == kSideCaptionEnv then
    if #content > 1 then
      content:insert(2, pandoc.Para(captionInlines))
    else
      content:insert(#content, pandoc.Para(captionInlines))
    end
  else 
    content:insert(pandoc.Para(captionInlines))
  end
end

function isStarEnv(clz) 
  return (clz:match('^column%-screen') or clz:match('^column%-page')) and not clz:match('%-left$')
end

function isMarginEnv(clz) 
  return clz == 'column-margin' or clz == 'aside'
end

function latexMinipageValign(vAlign) 
  if vAlign == "top" then
   return "[t]"
  elseif vAlign == "bottom" then 
    return "[b]"
  elseif vAlign == "center" then 
    return "[c]"
  else
   return ""
  end
end

