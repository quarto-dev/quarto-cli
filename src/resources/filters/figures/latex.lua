-- latex.lua
-- Copyright (C) 2020 by RStudio, PBC

function latexFigureDiv(divEl, subfigures)
  
  -- create panel
  local figure = pandoc.Div({})
  
  -- begin the figure
  local figEnv = attribute(divEl, "fig-env", "figure")
  figure.content:insert(pandoc.RawBlock("latex", "\\begin{" .. figEnv .. "}"))
  
  -- alignment
  local align = attribute(divEl, "fig-align", nil)
  if align then
    figure.content:insert(latexBeginAlign(align))
  end
  
  -- subfigures
  if subfigures then
    local subfiguresEl = pandoc.Para({})
    for i, row in ipairs(subfigures) do
      
      for _, image in ipairs(row) do
        
        -- begin subfigure
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\\begin{subfigure}[b]"))
         
        -- check to see if it has a width to apply (if so then reset the
        -- underlying width to 100% as sizing will come from subfigure box)
        local layoutPercent = horizontalLayoutPercent(image)
        if layoutPercent then
          image.attr.attributes["width"] = nil
        else
          layoutPercent = 100
        end
        subfiguresEl.content:insert(pandoc.RawInline("latex", 
          "{" .. string.format("%2.2f", layoutPercent/100) .. "\\linewidth}"
        ))
        
        -- see if have a caption (different depending on whether it's an Image or Div)
        local caption = nil
        if image.t == "Image" then
          caption = image.caption:clone()
          tclear(image.caption)
        else 
          caption = figureDivCaption(image).content
        end
        
        -- build caption
        if image.attr.identifier ~= "" and inlinesToString(caption) ~= "" then
          caption:insert(1, pandoc.RawInline("latex", "  \\caption{"))
          if image.attr.identifier ~= "" then
            caption:insert(pandoc.RawInline("latex", "\\label{" .. image.attr.identifier .. "}"))
          end
          caption:insert(pandoc.RawInline("latex", "}\n"))
        end
        image.attr.identifier = ""
        
        -- insert content
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\n  "))
        if image.t == "Div" then
          -- append the div, slicing off the caption block
          tappend(subfiguresEl.content, pandoc.utils.blocks_to_inlines(
            tslice(image.content, 1, #image.content-1),
            { pandoc.LineBreak() }
          ))
        else
          subfiguresEl.content:insert(image)
        end
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\n"))
        
        -- insert caption
        if #caption > 0 then
          tappend(subfiguresEl.content, caption)
        end
      
        -- end subfigure
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\\end{subfigure}\n"))
        
      end
      
      -- insert separator unless this is the last row
      if i < #subfigures then
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\\newline\n"))
      end
      
    end
    figure.content:insert(subfiguresEl)
  --  no subfigures, just forward content
  else
    tappend(figure.content, tslice(divEl.content, 1, #divEl.content - 1))
  end
  
  -- end alignment
  if align then
    figure.content:insert(latexEndAlign(align))
  end
  
  -- surround caption w/ appropriate latex (and end the figure)
  local caption = figureDivCaption(divEl)
  if caption and #caption.content > 0 then
    caption.content:insert(1, pandoc.RawInline("latex", "\\caption{"))
    tappend(caption.content, {
      pandoc.RawInline("latex", "}\\label{" .. divEl.attr.identifier .. "}\n"),
    })
    figure.content:insert(caption)
  end
  
  -- end figure
  figure.content:insert(pandoc.RawBlock("latex", "\\end{" .. figEnv .. "}"))
  
  -- return the figure
  return figure
  
end


function latexBeginAlign(align)
  local beginAlign = pandoc.RawBlock("latex", "\n")
  if align == "center" then
    beginAlign.text = "{\\centering"
  elseif align == "right" then
    beginAlign.text = "\\hfill{}"      
  end
  return beginAlign
end

function latexEndAlign(align)
  local endAlign = pandoc.RawBlock("latex", "\n")
  if align == "center" then
    endAlign.text = "}"
  elseif align == "left" then
    endAlign.text = "\\hfill{}"
  end
  return endAlign
end


-- align1 = if (plot1)
--    switch(a, left = '\n\n', center = '\n\n{\\centering ', right = '\n\n\\hfill{}', '\n')
--  # close align code if this picture is standalone/last in set
--  align2 = if (plot2)
--    switch(a, left = '\\hfill{}\n\n', center = '\n\n}\n\n', right = '\n\n', '')




