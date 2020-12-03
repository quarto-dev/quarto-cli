

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
  
  -- subfigures
  for _, el in ipairs(subfigures) do
    
    local image = figureFromPara(el)
    if image then
      -- begin subfloat
      local subfloat = pandoc.Para({pandoc.RawInline("latex", "\\subfloat[")})
      tappend(subfloat.content, image.caption)
      subfloat.content:insert(pandoc.RawInline("latex", "\\label{" .. image.attr.identifier .. "}]{"))
      
      -- insert the image (strip the id and caption b/c they are already on the subfloat)
      image.attr.identifier = ""
      tclear(image.attr.classes)
      tclear(image.caption)
      subfloat.content:insert(image)
      
      -- end subfloat
      subfloat.content:insert(pandoc.RawInline("latex", "}"))
      
      -- insert the subfig
      panel.content:insert(subfloat)
    end
  end
  
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




