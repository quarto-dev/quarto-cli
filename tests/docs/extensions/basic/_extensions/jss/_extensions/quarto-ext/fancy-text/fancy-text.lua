-- shortcode that provides a nicely formatted 'LaTeX' string
function latex()
  if quarto.doc.isFormat("pdf") then
    return pandoc.RawBlock('tex', '{\\LaTeX}')
  elseif quarto.doc.isFormat("html") then
    return pandoc.Math('InlineMath', "\\LaTeX")
  else 
    return pandoc.Span('LaTeX')
  end
end
  
-- shortcode that provides a nicely formatted 'bibtex' string
function bibtex()
  if quarto.doc.isFormat("pdf") then
    return pandoc.RawBlock('tex', '\\textsc{Bib}{\\TeX}')
  elseif quarto.doc.isFormat("html") then
    return pandoc.RawBlock('html', '<span style="font-variant: small-caps;">Bib</span><span style="letter-spacing:-2px;">T</span><sub style="font-size: inherit; letter-spacing:-1px;">E</sub>X')
  else
    return pandoc.Span('BibTeX')
  end
end