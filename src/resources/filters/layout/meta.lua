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
      if (layoutState.hasColumns or marginReferences() or marginCitations()) and isLatexOutput() then
        -- inject sidenotes package
        metaInjectLatex(meta, function(inject)
          inject(
            usePackage("sidenotes")
          )
          inject(
            usePackage("marginnote")
          )
        end)
        
        if marginCitations() and meta.bibliography ~= undefined then 
          local citeMethod = param('cite-method', 'citeproc')
          if citeMethod == 'natbib' then
            metaInjectLatex(meta, function(inject)
              inject(
                usePackage("bibentry")
              )  
              inject(
                usePackage("marginfix")
              )  

            end)
            metaInjectLatex(meta, function(inject)
              inject(
                '\\nobibliography*'
              )
            end)
  
          elseif citeMethod == 'biblatex' then
            metaInjectLatex(meta, function(inject)
              inject(
                usePackage("biblatex")
              )  
            end)
          end

          -- If the user specifies 'code-block-border-left: false'
          -- then we should't give the code blocks this treatment
          local kCodeBlockBorderLeft = 'code-block-border-left'
          if meta[kCodeBlockBorderLeft] == nil or meta[kCodeBlockBorderLeft] then
            metaInjectLatex(meta, function(inject)
              inject(
                usePackageWithOption("tcolorbox", "many")
              )
            end)

            -- set color options for code blocks ('Shaded')
            -- shadecolor is defined by pandoc
            local options = {
              ['interior hidden'] = "",
              boxrule = '0pt',
              ['frame hidden'] = "",
              ['sharp corners'] = "",
              enhanced = "",
              ['borderline west'] = '{3pt}{0pt}{shadecolor}'
            }
            
            -- redefined the 'Shaded' environment that pandoc uses for fenced 
            -- code blocks
            metaInjectLatexBefore(meta, function(inject)
              inject("\\ifdefined\\Shaded\\renewenvironment{Shaded}{\\begin{tcolorbox}[" .. tColorOptions(options) .. "]}{\\end{tcolorbox}}\\fi")
            end)
          end

        end

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

function marginReferences() 
  return param('reference-location', 'document') == 'margin'
end 

function marginCitations()
  return param('citation-location', 'document') == 'margin'
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
  local userDefinedGeometry = #meta.geometry ~= 0

  -- if only 'showframe' is passed, we can still modify the geometry
  if #meta.geometry == 1 then
    if #meta.geometry[1] == 1 then
      local val = meta.geometry[1][1]
      if val.t == 'Str' and val.text == 'showframe' then
        userDefinedGeometry = false
      end
    end
  end 
  
  if not userDefinedGeometry then
    tappend(meta.geometry, geometryForPaper(meta.papersize))
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
  local geometry = pandoc.List({})
  geometry:insert(metaInlineStr('left=' .. left(paperWidth) .. 'in'))
  geometry:insert(metaInlineStr('marginparwidth=' .. marginParWidth(paperWidth) .. 'in'))
  geometry:insert(metaInlineStr('textwidth=' .. textWidth(paperWidth) .. 'in'))
  geometry:insert(metaInlineStr('marginparsep=' .. marginParSep(paperWidth) .. 'in'))
  return geometry
end

function metaInlineStr(str) 
  return pandoc.MetaInlines({pandoc.Str(str)})
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


