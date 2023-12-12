Pandoc = function(doc)
  local found = false
  doc.blocks:walk({
    Div = function(div) 
      if div.classes:includes("cell-output-display") then
        found = true
      end
    end
  })
  if not found then
    error("Should have found a wrapping cell here")
    crash_with_stack_trace()
  end
end