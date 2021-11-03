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

      
      -- check if global options are enabled (e.g. footnotes-margin)
      local referenceLocation = param('reference-location', 'document')

      -- enable column layout (packages and adjust geometry)
      if (layoutState.hasColumns or referenceLocation == 'gutter') and isLatexOutput() then
        -- inject sidenotes package
        metaInjectLatex(meta, function(inject)
          inject(
            usePackage("sidenotes")
          )
          inject(
            usePackage("marginnote")
          )
        end)

        -- add layout configuration based upon the document class
        -- we will customize any koma templates that have no custom geometries 
        -- specified. If a custom geometry is specified, we're expecting the
        -- user to address the geometry and layout
        local documentclassRaw = readOption(meta, 'documentclass');
        if documentclassRaw ~= nil then 
          local documentclass = pandoc.utils.stringify(documentclassRaw)
          if documentclass == 'scrartcl' then
            oneSidedColumnLayout(meta)
          elseif documentclass == 'scrbook' then
            twoSidedColumnLayout(meta)
          elseif documentclass == 'scrreport' then
            oneSidedColumnLayout(meta)
          end  
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
    meta.geometry = geometryForPaper(meta.papersize)
  end
end

-- We will automatically compute a geometry for a papersize that we know about
function geometryForPaper(paperSize)
  local width = nil
  if paperSize ~= nil then
    local paperSizeStr = paperSize[1].text
    local width = kPaperWidthsIn[paperSizeStr]
    if width ~= nil then
      return geometryFromPaperWidth(width)
    else
      return pandoc.MetaList({})
    end
  else 
    return pandoc.MetaList({})
  end
end

function geometryFromPaperWidth(paperWidth) 
  local geometry = pandoc.MetaList({})
  geometry:insert('left=' .. left(paperWidth) .. 'in')
  geometry:insert('marginparwidth=' .. marginParWidth(paperWidth) .. 'in')
  geometry:insert('textwidth=' .. textWidth(paperWidth) .. 'in')
  geometry:insert('marginparsep=' .. marginParSep(paperWidth) .. 'in')
  geometry:insert('showframe')
  return geometry
end

-- We will only provide custom geometries for paper widths that we are 
-- aware of and that would work well for wide margins. Some sizes get
-- so small that there just isn't a good way to represent the margin layout
-- so we just throw up our hands and take the default geometry
kPaperWidthsIn = {
  a0 = 33.11,
  a1 = 23.39,
  a2 = 16.54,
  a3 = 11.69,
  a4 = 8.3,
  a5 = 5.83,
  a6 = 4.13,
  a7 = 2.91,
  a8 = 2.05,
  b0 = 39.37,
  b1 = 27.83,
  b2 = 19.69,
  b3 = 13.90,
  b4 = 9.84,
  b5 = 6.93,
  b6 = 4.92,
  b7 = 3.46,
  b8 = 2.44,
  b9 = 1.73,
  b10 = 1.22,
  letter = 8.5,
  legal = 8.5,
  ledger =  11,
  tabloid = 17,
  executive = 7.25
}

local kLeft = 1
local kMarginParSep = .3

function left(width)
  if width >= kPaperWidthsIn.a4 then
    return kLeft
  else
    return kLeft * width / kPaperWidthsIn.a4
  end
end

function marginParSep(width)
  if width >= kPaperWidthsIn.a6 then
    return kMarginParSep
  else
    return kMarginParSep * width / kPaperWidthsIn.a4
  end
end

function marginParWidth(width) 
  return (width - 2*left(width) - marginParSep(width)) / 3
end

function textWidth(width)
  return ((width - 2*left(width) - marginParSep(width)) * 2) / 3
end


