-- jats.lua
-- Copyright (C) 2021-2022 Posit Software, PBC




function jats()
  if _quarto.format.isJatsOutput() then
    return {}
  else 
    return {
      -- clear out divs
      Div = function(div)
        if _quarto.format.isJatsOutput() then
          -- unroll blocks contained in divs
          local blocks = pandoc.List()
          for _, childBlock in ipairs(div.content) do
            if childBlock.t == "Div" then
              tappend(blocks, childBlock.content)
            else
              blocks:insert(childBlock)
            end
          end
          return blocks
        end
      end
    }
  end
end
