--[[
  This file defines the shortcodes that your extension will make available
  https://quarto.org/docs/authoring/shortcodes.html#custom-shortcodes
  Quarto exports utils function that can be used in all filters. See 
  https://github.com/quarto-dev/quarto-cli/blob/main/src/resources/pandoc/datadir/init.lua#L1522-L1576
]]--

-- Example shortcode that provides a nicely formatted 'LaTeX' string
function latex()
  if quarto.doc.isFormat("pdf") then
    return pandoc.RawBlock('tex', '{\\LaTeX}')
  elseif quarto.doc.isFormat("html") then
    return pandoc.Math('InlineMath', "\\LaTeX")
  else 
    return pandoc.Span('LaTeX')
  end
end