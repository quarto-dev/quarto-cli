
--[[
     A Pandoc 2 Lua filter converting Pandoc native divs to LaTeX environments
     Author: Romain Lesur, Christophe Dervieux, and Yihui Xie
     License: Public domain
     Ported from: https://github.com/rstudio/rmarkdown/blob/80f14b2c6e63dcb8463df526354f4cd4fc72fd04/inst/rmarkdown/lua/latex-div.lua
--]]

function latexDiv()
  return {
    Div = function (divEl)
      -- look for 'latex' or 'data-latex' and at least 1 class
      local options = attribute(divEl, 'latex', attribute(divEl, 'data-latex'))
      if not options or #divEl.attr.classes == 0 then
        return nil
      end
      
      -- if the output format is not latex, remove the attr and return
      if not isLatexOutput() then
        divEl.attributes['latex'] = nil
        divEl.attributes['data-latex'] = nil
        return divEl
      end
      
      -- if it's "1" or "true" then just set it to empty string
      if options == "1" or options == "true" then
        options = ""
      end
    
      -- get the environment
      local env = divEl.classes[1]
      
      -- if the first and last div blocks are paragraphs then we can
      -- bring the environment begin/end closer to the content
      if divEl.content[1].t == "Para" and divEl.content[#divEl.content].t == "Para" then
         -- insert raw latex before content
        table.insert(
          divEl.content[1].content, 1,
          pandoc.RawInline('latex', '\\begin' .. '{' .. env .. '}' .. options .. "\n")
        )
        -- insert raw latex after content
        table.insert(
          divEl.content[#divEl.content].content,
          pandoc.RawInline('latex', '\n\\end{' .. env .. '}')
        )
      else
        -- insert raw latex before content
        table.insert(
          divEl.content, 1,
          pandoc.RawBlock('tex', '\\begin' .. '{' .. env .. '}' .. options)
        )
        -- insert raw latex after content
        table.insert(
          divEl.content,
          pandoc.RawBlock('tex', '\\end{' .. env .. '}')
        )
      end
      return divEl
    end
  }

end