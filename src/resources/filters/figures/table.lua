


function tablePanel(divEl, subfigures)
  
    -- create panel
  local panel = pandoc.Div({})
  
  
  -- alignment
  -- local align = attribute(divEl, "fig-align", nil)
  -- if align then
  --  panel.content:insert(latexBeginAlign(align))
  -- end
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    for _, image in ipairs(row) do
      
      if image.t == "Image" then
        panel.content:insert(pandoc.Para(image))
      else
        panel.content:insert(image)
      end
      
    end
  end
  
  return panel
end

