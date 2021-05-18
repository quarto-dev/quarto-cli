-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function layoutMetaInject()
  return {
    Meta = function(meta)
      
      metaInjectLatex(meta, function(inject)
        inject(
          usePackage("caption") .. "\n" ..
          usePackage("subfig")
        )
        if layoutState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
      
      metaInjectHtml(meta, function(inject)
        if layoutState.layoutCss then
          inject([[
<style type="text/css">
  .quarto-layout-panel > figure > figcaption,
  .quarto-layout-panel > .panel-caption {
    margin-top: 10pt;
  }
  .quarto-layout-row {
    display: flex;
    align-items: flex-start;
  }
  .quarto-layout-valign-top {
    align-items: flex-start;
  }
  .quarto-layout-valign-bottom {
    align-items: flex-end;
  }
  .quarto-layout-valign-center {
    align-items: center;
  }
  .quarto-layout-cell {
    position: relative;
    margin-right: 20px;
  }
  .quarto-layout-cell:last-child {
    margin-right: 0;
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
  .quarto-layout-cell figure {
    display: inline-block;
    margin-inline-start: 0;
    margin-inline-end: 0;
  }
  .quarto-layout-cell table {
     display: inline-table;
  }
  .quarto-layout-cell-subref figcaption {
    font-style: italic;
  }
  .quarto-figure {
    position: relative;
  }
  .quarto-figure > figure {
    width: 100%;
  }
  .quarto-figure-left > figure > p {
   text-align: left;
  }
  .quarto-figure-center > figure > p {
    text-align: center;
  }
  .quarto-figure-right > figure > p {
    text-align: right;
  }
  figure > p:empty {
    display: none;
  }
  figure > p:first-child {
    margin-top: 0;
    margin-bottom: 0;
  }
  figure > figcaption {
    margin-top: 0.5em;
  }
</style>
]]
          )
        end
      end)
      
      return meta
    end
  }
end

