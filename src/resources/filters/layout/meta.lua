-- meta.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function layout_meta_inject_latex_packages()
  return {
    Meta = function(meta)
      
      -- inject caption, subfig, tikz
      metaInjectLatex(meta, function(inject)
        inject(
          usePackage("caption") .. "\n" ..
          usePackage("subcaption")
        )
        if layoutState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)

      -- This indicates whether the text highlighting theme has a 'light/dark' variant
      -- if it doesn't adapt, we actually will allow the text highlighting theme to control
      -- the appearance of the code block (e.g. so solarized will get a consistent yellow bg)
      local adaptiveTextHighlighting = param('adaptive-text-highlighting', false)

      -- If the user specifies 'code-block-border-left: false'
      -- then we should't give the code blocks this treatment
      local kCodeBlockBorderLeft = 'code-block-border-left'
      local kCodeBlockBackground = 'code-block-bg'

      -- Track whether to show a border or background
      -- Both options could be undefined, true / false or set to a color value
      local useCodeBlockBorder = (adaptiveTextHighlighting and meta[kCodeBlockBorderLeft] == nil and meta[kCodeBlockBackground] == nil) or (meta[kCodeBlockBorderLeft] ~= nil and meta[kCodeBlockBorderLeft] ~= false)
      local useCodeBlockBg = meta[kCodeBlockBackground] ~= nil and meta[kCodeBlockBackground] ~= false

      -- if we're going to display a border or background
      -- we need to inject color handling as well as the 
      -- box definition for code blocks
      if (useCodeBlockBorder or useCodeBlockBg) then
        metaInjectLatex(meta, function(inject)
          inject(
            usePackageWithOption("tcolorbox", "skins,breakable")
          )
        end)

        -- figure out the shadecolor
        local shadeColor = nil
        local bgColor = nil

        if useCodeBlockBorder and meta[kCodeBlockBorderLeft] and type(meta[kCodeBlockBorderLeft]) ~= "boolean" then
          shadeColor = latexXColor(meta[kCodeBlockBorderLeft])
        end
        if useCodeBlockBg and meta[kCodeBlockBackground] and type(meta[kCodeBlockBackground]) ~= "boolean"  then
          bgColor = latexXColor(meta[kCodeBlockBackground])
        end

        -- ensure shadecolor is defined
        metaInjectLatex(meta, function(inject)
          if (shadeColor ~= nil) then
            inject(
              "\\@ifundefined{shadecolor}{\\definecolor{shadecolor}" .. shadeColor .. "}{}"
            )  
          else
            inject(
              "\\@ifundefined{shadecolor}{\\definecolor{shadecolor}{rgb}{.97, .97, .97}}{}"
            )  
          end
        end)

        metaInjectLatex(meta, function(inject)
          if (bgColor ~= nil) then
            inject(
              "\\@ifundefined{codebgcolor}{\\definecolor{codebgcolor}" .. bgColor .. "}{}"
            )  
          end
        end)

        -- set color options for code blocks ('Shaded')
        -- core options
        local options = {
          boxrule = '0pt',
          ['frame hidden'] = "",
          ['sharp corners'] = "",
          ['breakable'] = "",
          enhanced = "",
        }
        if bgColor then 
          options.colback = "{codebgcolor}"
        else 
          options['interior hidden'] = ""
        end

        if useCodeBlockBorder then
          options['borderline west'] = '{3pt}{0pt}{shadecolor}'
        end
        
        -- redefined the 'Shaded' environment that pandoc uses for fenced 
        -- code blocks
        metaInjectLatex(meta, function(inject)
          inject("\\ifdefined\\Shaded\\renewenvironment{Shaded}{\\begin{tcolorbox}[" .. tColorOptions(options) .. "]}{\\end{tcolorbox}}\\fi")
        end)
      end



      -- enable column layout (packages and adjust geometry)
      if (layoutState.hasColumns or marginReferences() or marginCitations()) and _quarto.format.isLatexOutput() then
        -- inject sidenotes package
        metaInjectLatex(meta, function(inject)
          inject(
            usePackage("sidenotes")
          )
          inject(
            usePackage("marginnote")
          )
        end)
        
        if marginCitations() and meta.bibliography ~= nil then 
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
        end

        -- add layout configuration based upon the document class
        -- we will customize any koma templates that have no custom geometries 
        -- specified. If a custom geometry is specified, we're expecting the
        -- user to address the geometry and layout
        local documentclassRaw = readOption(meta, 'documentclass');
        if documentclassRaw ~= nil then 
          local documentclass = pandoc.utils.stringify(documentclassRaw)
          if documentclass == 'scrartcl' or documentclass == 'scrarticle' or 
             documentclass == 'scrlttr2' or documentclass == 'scrletter' or
             documentclass == 'scrreprt' or documentclass == 'scrreport' then
            oneSidedColumnLayout(meta)
          elseif documentclass == 'scrbook' then
            -- better compute sidedness and deal with it
            -- choices are one, two, or semi
            local side = booksidedness(meta)
            if side == 'one' then
              oneSidedColumnLayout(meta)
            else
              twoSidedColumnLayout(meta, side == 'semi')
            end
          end  
        end
      end

      -- enable column layout for Typst (configure page geometry for margin notes)
      if (layoutState.hasColumns or marginReferences() or marginCitations()) and _quarto.format.isTypstOutput() then
        -- Use specified papersize, or default to us-letter (matches Quarto's Typst template default)
        local paperWidth = typstPaperWidth(meta.papersize) or kPaperWidthsIn["letter"]
        if paperWidth then
          -- Read margin options (margin.left, margin.right, margin.x)
          local marginOptions = nil
          if meta.margin then
            marginOptions = {
              left = meta.margin.left or meta.margin.x or nil,
              right = meta.margin.right or meta.margin.x or nil,
            }
          end

          -- Read grid options (grid.margin-width, grid.gutter-width)
          local gridOptions = nil
          if meta.grid then
            gridOptions = {
              ["margin-width"] = meta.grid["margin-width"] or nil,
              ["body-width"] = meta.grid["body-width"] or nil,
              ["gutter-width"] = meta.grid["gutter-width"] or nil,
            }
          end

          -- Compute default geometry from paper size and grid options
          local computedGeometry = typstGeometryFromPaperWidth(paperWidth, marginOptions, gridOptions)

          -- Merge with any user-specified margin-geometry overrides
          meta["margin-geometry"] = mergeMarginGeometry(computedGeometry, meta["margin-geometry"])
        end

        -- Suppress bibliography when using margin citations (consistent with HTML behavior)
        -- Full citations appear in margins, no end bibliography needed
        if marginCitations() then
          meta["suppress-bibliography"] = true
        end

        -- Add show rule to transform footnotes to sidenotes when reference-location: margin
        if marginReferences() then
          quarto.doc.include_text('in-header',
            '// Transform footnotes to sidenotes\n' ..
            '#show footnote: it => column-sidenote(it.body)\n' ..
            '#show footnote.entry: none\n')
        end
      end

      return meta
    end
  }
end

function booksidedness(meta)
  local side = 'two'
  local classoption = readOption(meta, 'classoption')
  if classoption then
    for i, v in ipairs(classoption) do
      local option = pandoc.utils.stringify(v)
      if option == 'twoside=semi' then
        side = 'semi'
      elseif option == 'twoside' or option == 'twoside=on' or option == 'twoside=true' or option == 'twoside=yes' then
        side = 'two'
      elseif option == 'twoside=false' or option == 'twoside=no' or option == 'twoside=off' then
        side = 'one'
      end
    end
  end
  return side
end

function marginReferences() 
  return param('reference-location', 'document') == 'margin'
end 

function marginCitations()
  return param('citation-location', 'document') == 'margin'
end

function twoSidedColumnLayout(meta, oneside)
  baseGeometry(meta, oneside)
end

function oneSidedColumnLayout(meta)
  local classoption = readOption(meta, 'classoption')
  if classoption == nil then
    classoption = pandoc.List({})
  end

  -- set one sided if not sidedness not already set
  local sideoptions = classoption:filter(function(opt) 
    local text = pandoc.utils.stringify(opt)
    return text:find('oneside') == 1 or text:find('twoside') == 1
  end)
  
  if #sideoptions == 0 then
    classoption:insert('oneside')
    meta.classoption = classoption
  end
  
  baseGeometry(meta)
end

function baseGeometry(meta, oneside)

  -- customize the geometry
  if not meta.geometry then
    meta.geometry = pandoc.List({})
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
    -- if one side geometry is explicitly requested, the
    -- set that (used for twoside=semi)
    if oneside then
      tappend(meta.geometry, {"twoside=false"})
    end
      
    tappend(meta.geometry, geometryForPaper(meta.papersize))
  end
end

-- We will automatically compute a geometry for a papersize that we know about
function geometryForPaper(paperSize)
  if paperSize ~= nil then
    local paperSizeStr = paperSize[1].text
    local width = kPaperWidthsIn[paperSizeStr]
    if width ~= nil then
      return geometryFromPaperWidth(width)
    else
      return pandoc.List({})
    end
  else 
    return pandoc.List({})
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
  return pandoc.Inlines({pandoc.Str(str)})
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

-- Typst paper width lookup (reuse kPaperWidthsIn)
function typstPaperWidth(paperSize)
  if paperSize ~= nil then
    local paperSizeStr = pandoc.utils.stringify(paperSize)
    -- Typst uses lowercase paper names, normalize input
    paperSizeStr = string.lower(paperSizeStr)
    -- Map some Typst-specific names
    if paperSizeStr == "us-letter" then
      paperSizeStr = "letter"
    elseif paperSizeStr == "us-legal" then
      paperSizeStr = "legal"
    end
    return kPaperWidthsIn[paperSizeStr]
  end
  return nil
end

-- Parse CSS/Typst length values (e.g., "250px", "2.5in", "1.5em")
-- Returns value in inches, or nil if parsing fails
function parseCssLength(value)
  if value == nil then return nil end
  local str = pandoc.utils.stringify(value)
  local num, unit = string.match(str, "^([%d%.]+)(%a+)$")
  if num == nil then return nil end
  num = tonumber(num)
  if num == nil then return nil end

  -- Convert to inches for marginalia
  if unit == "in" then
    return num
  elseif unit == "px" then
    return num / 96  -- 96 DPI standard
  elseif unit == "pt" then
    return num / 72
  elseif unit == "cm" then
    return num / 2.54
  elseif unit == "mm" then
    return num / 25.4
  elseif unit == "em" then
    return num * 11 / 72  -- Assume 11pt base font
  else
    return num  -- Assume inches if no recognized unit
  end
end

-- Compute Typst geometry from paper width for marginalia package
-- Uses marginalia's recommended proportions (from A4 example: 16:40:8 for outer, 16:20:8 for inner)
-- Total: inner 21% + outer 30.5% + body 48.5% = 100%
-- marginOptions: table with left, right keys (user margin overrides)
-- gridOptions: table with margin-width, gutter-width keys (user grid overrides)
function typstGeometryFromPaperWidth(paperWidth, marginOptions, gridOptions)
  -- Marginalia proportions (from A4 example)
  -- inner: (far: 16mm, width: 20mm, sep: 8mm) = 44mm = 21% of 210mm
  -- outer: (far: 16mm, width: 40mm, sep: 8mm) = 64mm = 30.5% of 210mm
  -- body: 102mm = 48.5% of 210mm

  -- Base proportions (relative to page width)
  local innerTotal = 0.21 * paperWidth   -- 21% of page
  local outerTotal = 0.305 * paperWidth  -- 30.5% of page
  -- body = 48.5% of page (remainder)

  -- Apply inner ratio 2:2.5:1 = far:width:sep
  -- Sum = 5.5, so: far=2/5.5, width=2.5/5.5, sep=1/5.5
  local innerFar = innerTotal * (2 / 5.5)
  local innerWidth = innerTotal * (2.5 / 5.5)
  local innerSep = innerTotal * (1 / 5.5)

  -- Apply outer ratio 2:5:1 = far:width:sep
  -- Sum = 8, so: far=2/8, width=5/8, sep=1/8
  local outerFar = outerTotal * (2 / 8)
  local outerWidth = outerTotal * (5 / 8)
  local outerSep = outerTotal * (1 / 8)

  -- Track if user specified margin.left (affects gutter-width logic)
  local marginLeftSpecified = false

  -- Apply user overrides from margin options
  -- margin.left -> inner.sep (separation between body and inner margin column)
  -- margin.right -> outer.far (distance from outer page edge)
  if marginOptions then
    if marginOptions.left then
      local parsed = parseCssLength(marginOptions.left)
      if parsed then
        innerSep = parsed
        marginLeftSpecified = true
      end
    end
    if marginOptions.right then
      local parsed = parseCssLength(marginOptions.right)
      if parsed then outerFar = parsed end
    end
  end

  -- Apply user overrides from grid options
  if gridOptions then
    if gridOptions["margin-width"] then
      local parsed = parseCssLength(gridOptions["margin-width"])
      if parsed then outerWidth = parsed end
    end
    if gridOptions["gutter-width"] then
      local parsed = parseCssLength(gridOptions["gutter-width"])
      if parsed then
        -- gutter-width sets outer.sep always
        outerSep = parsed
        -- gutter-width sets inner.sep only if margin.left wasn't specified
        if not marginLeftSpecified then
          innerSep = parsed
        end
      end
    end
  end

  return {
    inner = {
      far = string.format("%.3fin", innerFar),
      width = string.format("%.3fin", innerWidth),
      separation = string.format("%.3fin", innerSep),
    },
    outer = {
      far = string.format("%.3fin", outerFar),
      width = string.format("%.3fin", outerWidth),
      separation = string.format("%.3fin", outerSep),
    },
    clearance = "12pt",  -- Match marginalia default
  }
end

-- Deep merge margin geometry tables, with overrides taking precedence
-- Only merges non-nil values from overrides
function mergeMarginGeometry(defaults, overrides)
  if overrides == nil then return defaults end

  local result = {}

  -- Merge inner
  result.inner = {}
  for k, v in pairs(defaults.inner) do
    result.inner[k] = v
  end
  if overrides.inner then
    for k, v in pairs(overrides.inner) do
      if v ~= nil then
        result.inner[k] = pandoc.utils.stringify(v)
      end
    end
  end

  -- Merge outer
  result.outer = {}
  for k, v in pairs(defaults.outer) do
    result.outer[k] = v
  end
  if overrides.outer then
    for k, v in pairs(overrides.outer) do
      if v ~= nil then
        result.outer[k] = pandoc.utils.stringify(v)
      end
    end
  end

  -- Merge clearance
  if overrides.clearance ~= nil then
    result.clearance = pandoc.utils.stringify(overrides.clearance)
  else
    result.clearance = defaults.clearance
  end

  return result
end

