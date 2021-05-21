-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoPostMetaInject()
  return {
    Meta = function(meta)
      
      metaInjectHtml(meta, function(inject)
       
          inject([[
<style type="text/css">
  details {
    margin-bottom: 1em;
  } 
  details[show] {
    margin-bottom: 0;
  }

  .quarto-unresolved-ref {
    font-weight: 600;
  }

  .quarto-cover-image {
    max-width: 35%;
    float: right;
    margin-left: 30px;
  }

  .cell-output-display {
    overflow-x: scroll;
  }

  .hidden {
    display: none;
  }
</style>
]]
          )
        
      end)
      
      return meta
    end
  }
end

