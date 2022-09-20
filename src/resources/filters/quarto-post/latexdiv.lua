
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
      if not _quarto.format.isLatexOutput() then
        divEl.attributes['latex'] = nil
        divEl.attributes['data-latex'] = nil
        return divEl
      end
      
      -- if it's "1" or "true" then just set it to empty string
      if options == "1" or pandoc.text.lower(options) == "true" then
        options = ""
      end
    
      -- environment begin/end
      local env = divEl.classes[1]
      local beginEnv = '\\begin' .. '{' .. env .. '}' .. options
      local endEnv = '\n\\end{' .. env .. '}'
      
      -- if the first and last div blocks are paragraphs then we can
      -- bring the environment begin/end closer to the content
      if divEl.content[1].t == "Para" and divEl.content[#divEl.content].t == "Para" then
        table.insert(divEl.content[1].content, 1, pandoc.RawInline('tex', beginEnv .. "\n"))
        table.insert(divEl.content[#divEl.content].content, pandoc.RawInline('tex', "\n" .. endEnv))
      else
        table.insert(divEl.content, 1, pandoc.RawBlock('tex', beginEnv))
        table.insert(divEl.content, pandoc.RawBlock('tex', endEnv))
      end
      return divEl
    end
  }

end