-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      
      metaInjectLatex(doc, function(inject)
        inject(
          usePackage("caption") .. "\n" ..
          usePackage("subcaption")
        )
        if figures.usingTikz then
          inject(usePackage("tikz"))
        end
        inject(usePackage("animate"))
      end)
      
      metaInjectHtml(doc, function(inject)
        if figures.htmlFigures then
          inject([[
<style type="text/css">
  .quarto-figure-panel > figure > figcaption {
    margin-top: 10pt;
    text-align: center;
  }
  .quarto-figure figure {
    display: inline-block;
    margin-inline-start: 0;
    margin-inline-end: 0;
  }
  .quarto-subfigure-row {
    display: flex;
    align-items: flex-end;
  }
  .quarto-subfigure {
    position: relative;
  }
  .quarto-subfigure figure,
  .quarto-subfigure > p {
    margin: 0.2em;
  }
  .quarto-subfigure img {
    max-width: 100%;
  }
  .quarto-subfigure .html-widget {
    width: 100% !important;
  }
  .quarto-subfigure figcaption {
    text-align: center;
    font-size: 0.8em;
    font-style: italic;
  }
  .quarto-subfigure div figure p {
    margin: 0;
  }
  figure > p:empty {
    display: none;
  }
  figure > p:first-child {
    margin-top: 0;
    margin-bottom: 0;
  }
</style>
]]
          )
        end
      end)
      
      return doc
    end
  }
end

