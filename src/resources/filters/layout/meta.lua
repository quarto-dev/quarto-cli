-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function layoutMetaInject()
  return {
    Meta = function(meta)
      
      -- inject caption, subfig, tikz
      metaInjectLatex(meta, function(inject)
        inject(
          usePackage("caption") .. "\n" ..
          usePackage("subfig")
        )
        if layoutState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)

      -- enable column layout (packages and adjust geometry)
      if layoutState.hasColumns and isLatexOutput() then
        -- inject sidenotes package
        metaInjectLatex(meta, function(inject)
          inject(
            usePackage("sidenotes")
          )
          inject(
            usePackage("marginnote")
          )
        end)
        local documentclass = pandoc.utils.stringify(readOption(meta, 'documentclass'))

        if documentclass == 'scrartcl' then
          oneSidedColumnLayout(meta)
        elseif documentclass == 'scrbook' then
          twoSidedColumnLayout(meta)
        elseif documentclass == 'scrreport' then
          oneSidedColumnLayout(meta)
        end
      end
      return meta
    end
  }
end

function twoSidedColumnLayout(meta)
  columnGeometry(meta)
end

function oneSidedColumnLayout(meta)
  local classoption = readOption(meta, 'classoption')
  if classoption == nil then
    classoption = pandoc.MetaList({})
  end

  -- set one sided if not sidedness not already set
  local sideoptions = classoption:filter(function(opt) 
    local text = pandoc.utils.stringify(opt)
    return text == 'oneside' or text == 'twoside'
  end)
  if #sideoptions == 0 then
    classoption:insert('oneside')
    meta.classoption = classoption
  end
  
  columnGeometry(meta)

end

function columnGeometry(meta) 
  -- customize the geometry
  if not meta.geometry then
    meta.geometry = pandoc.MetaList({})
  end  
  if #meta.geometry == 0 then
    meta.geometry:insert('left=1in')
    meta.geometry:insert('marginparwidth=2.15in')
    meta.geometry:insert('textwidth=4.35in')
    meta.geometry:insert('marginparsep=.3in')
  end

end

