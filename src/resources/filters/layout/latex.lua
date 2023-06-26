-- latex.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
kSideCaptionEnv = 'sidecaption'

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isLatexOutput()
end, function(panel_layout)
  fail("womp womp")
end)

function latexPanel(divEl, layout, caption)
  
   -- create container
  local panel = pandoc.Div({})
 
  -- begin container
  local env, pos = latexPanelEnv(divEl, layout)
  panel.content:insert(latexBeginEnv(env, pos));

  local capType = "fig"
  local locDefault = "bottom"
  if hasTableRef(divEl) then
    capType = "tbl"
    locDefault = "top"
  end
  local capLoc = capLocation(capType, locDefault)
  if (caption and capLoc == "top") then
    insertLatexCaption(divEl, panel.content, caption.content)
  end
  
   -- read vertical alignment and strip attribute
  local vAlign = validatedVAlign(divEl.attr.attributes[kLayoutVAlign])
  divEl.attr.attributes[kLayoutVAlign] = nil

  for i, row in ipairs(layout) do
    
    for j, cell in ipairs(row) do
      
      -- there should never be \begin{table} inside a panel (as that would 
      -- create a nested float). this can happen if knitr injected it as a 
      -- result of a captioned latex figure. in that case remove it
      cell = latexRemoveTableDelims(cell)
      
      -- process cell (enclose content w/ alignment)
      local endOfTable = i == #layout
      local endOfRow = j == #row
      local prefix, content, suffix = latexCell(cell, vAlign, endOfRow, endOfTable)
      panel.content:insert(prefix)
      local align = cell.attr.attributes[kLayoutAlign]
      if align == "center" then
        panel.content:insert(pandoc.RawBlock("latex", latexBeginAlign(align)))
      end
      tappend(panel.content, content)
      if align == "center" then
        panel.content:insert(pandoc.RawBlock("latex", latexEndAlign(align)))
      end
      panel.content:insert(suffix)
    end
    
  end
  
  -- surround caption w/ appropriate latex (and end the panel)
  if caption and capLoc == "bottom" then
    insertLatexCaption(divEl, panel.content, caption.content)
  end
  
  -- end latex env
  panel.content:insert(latexEndEnv(env));
  
  -- conjoin paragarphs 
  panel.content = latexJoinParas(panel.content)
 
  -- return panel
  return panel
  
end

-- determine the environment (and pos) to use for a latex panel
function latexPanelEnv(divEl, layout)
  
  -- defaults
  local env = latexFigureEnv(divEl)
  local pos = nil
  
  -- explicit figure panel
  if hasFigureRef(divEl) then
    pos = attribute(divEl, kFigPos, pos)
  -- explicit table panel
  elseif hasTableRef(divEl) then
    env = latexTableEnv(divEl)
  -- if there are embedded tables then we need to use table
  else 
    local haveTables = layout:find_if(function(row)
      return row:find_if(hasTableRef)
    end)
    if haveTables then
      env = latexTableEnv(divEl)
    end
  end

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

function latexImageFigure(image)

  return renderLatexFigure(image, function(figure)
    
    -- make a copy of the caption and clear it
    local caption = image.caption:clone()
    tclear(image.caption)
    
    -- get align
    local align = figAlignAttribute(image)
   
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

function latexDivFigure(divEl)
  
  return renderLatexFigure(divEl, function(figure)
    
     -- get align
    local align = figAlignAttribute(divEl)

    -- append everything before the caption
    local blocks = tslice(divEl.content, 1, #divEl.content - 1)
    local figureContent = pandoc.List()
    if align == "center" then
      figureContent:insert(pandoc.RawBlock("latex", latexBeginAlign(align)))
    end
    tappend(figureContent, blocks)
    if align == "center" then
      figureContent:insert(pandoc.RawBlock("latex", latexEndAlign(align)))
    end
    
    -- return the figure and caption
    local caption = refCaptionFromDiv(divEl)
    if not caption then
      caption = pandoc.Inlines()
    end
    return figureContent, caption.content
   
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

  local capLoc = capLocation("fig", "bottom")  

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
    local offsetValue = el.attr.attributes['offset']
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
    return pandoc.RawBlock("latex", beginEnv)
  end
end

function latexEndEnv(env, inline)
  if inline then
    return pandoc.RawInline("latex", "\\end{" .. env .. "}")
  else
    return pandoc.RawBlock("latex", "\\end{" .. env .. "}")
  end
end

function latexCell(cell, vAlign, endOfRow, endOfTable)

  -- figure out what we are dealing with
  local label = cell.attr.identifier
  local image = figureImageFromLayoutCell(cell)
  if (label == "") and image then
    label = image.attr.identifier
  end
  local isFigure = isFigureRef(label)
  local isTable = isTableRef(label)
  local isSubRef = hasRefParent(cell) or (image and hasRefParent(image))
  local tbl = tableFromLayoutCell(cell)
  
  -- determine width 
  local width = cell.attr.attributes["width"]
  
  -- derive prefix, content, and suffix
  local prefix = pandoc.List()
  local subcap = pandoc.List()
  local content = pandoc.List()
  local suffix = pandoc.List()

  -- sub-captioned always uses \subfloat
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
    
    -- subcap
    latexAppend(subcap, "\\subcaption{\\label{" .. label .. "}")
    tappend(subcap, caption)
    latexAppend(subcap, "}\n")
  end
  
  -- convert to latex percent as necessary
  width = asLatexSize(width)

  -- start the minipage
  local miniPageVAlign = latexMinipageValign(vAlign)
  latexAppend(prefix, "\\begin{minipage}" .. miniPageVAlign .. "{" .. width .. "}\n")

  local capType = "fig"
  local locDefault = "bottom"
  if isTable then
    capType = "tbl"
    locDefault = "top"
  end
  local capLoc = capLocation(capType, locDefault)

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

-- Computes the figure position for a figure environment
-- (margin figures, for example, don't support position since 
-- they're already in the margin)
function latexFigurePosition(el, env) 
  if env == kMarginFigureEnv then
    return nil
  else
    return attribute(el, kFigPos, nil)
  end
end

function latexFigureEnv(el) 
 -- Check whether the user has specified a figure environment
  local figEnv = attribute(el, kFigEnv, nil)
  if figEnv ~= nil then
    -- the user specified figure environment
    return figEnv
  else    
    local env_name = crossref.categories.by_name[el.type].latex_env or "figure"
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

