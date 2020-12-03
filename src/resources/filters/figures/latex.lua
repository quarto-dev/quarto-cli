

function latexPanel(divEl, subfigures)
  
  -- create panel
  local panel = pandoc.Div({})
  
  -- begin the figure
  local figEnv = attribute(divEl, "fig-env", "figure")
  panel.content:insert(pandoc.RawBlock("latex", "\\begin{" .. figEnv .. "}"))
  
  -- alignment
  local align = attribute(divEl, "fig-align", nil)
  if align then
    panel.content:insert(latexBeginAlign(align))
  end
  
  -- determine the fig-layout:
  --  fig-cols: 2 
  --  fig-layout: [[0.2, 0.8, 0.2], [0.5, 0.5]]
  --  horizontal rules in the parent
  
  -- now determine the widths, if there are explicit widths then use them
  -- (filling the remainer). otherwise distribute the widths according to
  -- the number of figures in the row
  
  -- use \subcaptionbox width (e.g. [.4\linewidth]) and then set
  -- width=1\linewidth on the inner images
  
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for _, el in ipairs(subfigures) do
    
    local image = figureFromPara(el)
    if image then
      -- begin subfloat
      subfiguresEl.content:insert(pandoc.RawInline("latex", "\\subfloat["))
      tappend(subfiguresEl.content, image.caption)
      subfiguresEl.content:insert(pandoc.RawInline("latex", "\\label{" .. image.attr.identifier .. "}]{"))
      
      -- insert the image (strip the id and caption b/c they are already on the subfloat)
      image.attr.identifier = ""
      tclear(image.attr.classes)
      tclear(image.caption)
      -- surround w/ link if we have fig-link
      local figLink = attribute(image, "fig-link", nil)
      if figLink then
        image.attr.attributes["fig-link"] = nil
        image = pandoc.Link({ image }, figLink)
      end
      subfiguresEl.content:insert(image)
      
      -- end subfloat
      subfiguresEl.content:insert(pandoc.RawInline("latex", "} "))
    end
  end
  panel.content:insert(subfiguresEl)
  
  -- end alignment
  if align then
    panel.content:insert(latexEndAlign(align))
  end
  
  -- surround caption w/ appropriate latex (and end the figure)
  local caption = figureDivCaption(divEl)
  caption.content:insert(1, pandoc.RawInline("latex", "\\caption{"))
  tappend(caption.content, {
    pandoc.RawInline("latex", "}\\label{" .. divEl.attr.identifier .. "}\n"),
    pandoc.RawInline("latex", "\\end{" .. figEnv .. "}")
  })
  panel.content:insert(caption)
  
  
  -- return the panel
  return panel
  
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




