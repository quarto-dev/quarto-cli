--[[
  This test that none of our Lua processing is removing the div of id refs which is used to hold the bibliography placement 
  for Pandoc citeproc.
--]]
local ref_div_found = false

Blocks = function(blocks)
  blocks:walk({
    Div = function(div)
      if div.identifier == "refs" then
        quarto.log.output(div)
        ref_div_found = true
      end
    end
  })
end

Pandoc = function(doc)
  if not ref_div_found then
    error("No div with identifier 'refs' found")
    crash()
  end
end