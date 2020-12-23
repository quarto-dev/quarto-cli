-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      
      metaInjectLatex(doc, function(inject)
        inject(
          usePackage("caption") .. "\n" ..
          usePackage("subfig")
        )
        if layout.usingTikz then
          inject(usePackage("tikz"))
        end
        inject(usePackage("animate"))
      end)
      
      metaInjectHtml(doc, function(inject)
        if layout.layoutCss then
          inject([[
<style type="text/css">
  .quarto-layout-panel > figure > figcaption,
  .quarto-layout-panel > .panel-caption {
    margin-top: 10pt;
  }
  .quarto-layout-row {
    display: flex;
    align-items: flex-end;
  }
  .quarto-layout-cell {
    position: relative;
  }
  .quarto-layout-cell figure,
  .quarto-layout-cell > p {
    margin: 0.2em;
  }
  .quarto-layout-cell img {
    max-width: 100%;
  }
  .quarto-layout-cell .html-widget {
    width: 100% !important;
  }
  .quarto-layout-cell div figure p {
    margin: 0;
  }
  .quarto-layout-cell figure,
  .quarto-layout-cell table {
     display: inline-block;
     margin-inline-start: 0;
     margin-inline-end: 0;
  }
  .quarto-layout-cell-subref figcaption {
    font-size: 0.8em;
    font-style: italic;
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

