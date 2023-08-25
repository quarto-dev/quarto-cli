-- latex.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to LaTeX

local constants = require("modules/constants")

function latexCalloutBoxDefault(title, type, icon) 

  -- callout dimensions
  local leftBorderWidth = '.75mm'
  local borderWidth = '.15mm'
  local borderRadius = '.35mm'
  local leftPad = '2mm'
  local color = latexColorForType(type)
  local frameColor = latexFrameColorForType(type)

  local iconForType = iconForType(type)

  -- generate options
  local options = {
    breakable = "",
    colframe = frameColor,
    colbacktitle = color ..'!10!white',
    coltitle = 'black',
    colback = 'white',
    opacityback = 0,
    opacitybacktitle =  0.6,
    left = leftPad,
    leftrule = leftBorderWidth,
    toprule = borderWidth, 
    bottomrule = borderWidth,
    rightrule = borderWidth,
    arc = borderRadius,
    title = '{' .. title .. '}',
    titlerule = '0mm',
    toptitle = '1mm',
    bottomtitle = '1mm',
  }

  if icon ~= false and iconForType ~= nil then
    options.title = '\\textcolor{' .. color .. '}{\\' .. iconForType .. '}\\hspace{0.5em}' ..  options.title
  end

  -- the core latex for the box
  local beginInlines = { pandoc.RawInline('latex', '\\begin{tcolorbox}[enhanced jigsaw, ' .. tColorOptions(options) .. ']\n') }
  local endInlines = { pandoc.RawInline('latex', '\n\\end{tcolorbox}') }

  -- Add the titles and contents
  local calloutContents = pandoc.List({});

  -- the inlines
  return { 
    contents = calloutContents,
    beginInlines = beginInlines, 
    endInlines = endInlines
  }

end

-- create the tcolorBox
function latexCalloutBoxSimple(title, type, icon)

  -- callout dimensions
  local leftBorderWidth = '.75mm'
  local borderWidth = '.15mm'
  local borderRadius = '.35mm'
  local leftPad = '2mm'
  local color = latexColorForType(type)
  local colorFrame = latexFrameColorForType(type)

  -- generate options
  local options = {
    breakable = "",
    colframe = colorFrame,
    colback = 'white',
    opacityback = 0,
    left = leftPad,
    leftrule = leftBorderWidth,
    toprule = borderWidth, 
    bottomrule = borderWidth,
    rightrule = borderWidth,
    arc = borderRadius,
  }

  -- the core latex for the box
  local beginInlines = { pandoc.RawInline('latex', '\\begin{tcolorbox}[enhanced jigsaw, ' .. tColorOptions(options) .. ']\n') }
  local endInlines = { pandoc.RawInline('latex', '\n\\end{tcolorbox}') }

  -- generate the icon and use a minipage to position it
  local iconForCat = iconForType(type)
  if icon ~= false and iconForCat ~= nil then
    local iconName = '\\' .. iconForCat
    local iconColSize = '5.5mm'

    -- add an icon to the begin
    local iconTex = '\\begin{minipage}[t]{' .. iconColSize .. '}\n\\textcolor{' .. color .. '}{' .. iconName .. '}\n\\end{minipage}%\n\\begin{minipage}[t]{\\textwidth - ' .. iconColSize .. '}\n'
    tappend(beginInlines, {pandoc.RawInline('latex',  iconTex)})

    -- close the icon
    tprepend(endInlines, {pandoc.RawInline('latex', '\\end{minipage}%')});
  end

  -- Add the titles and contents
  local calloutContents = pandoc.List({});
  if title ~= nil then 
    tprepend(title.content, {pandoc.RawInline('latex', '\\textbf{')})
    tappend(title.content, {pandoc.RawInline('latex', '}\\vspace{2mm}')})
    calloutContents:insert(pandoc.Para(title.content))
  end

  -- the inlines
  return { 
    contents = calloutContents,
    beginInlines = beginInlines, 
    endInlines = endInlines
  }
end

-- format-specific fixups after custom rendering is done
function render_latex_fixups()
  return {}
end

function render_latex()
  if not _quarto.format.isLatexOutput() then
    return {}
  end

  return {
    Callout = function(node)
      -- read and clear attributes
      local lua_type = type
      local title = node.title
      local type = node.type
      local calloutAppearance = node.appearance
      local icon = node.icon
  
      -- Discover notes in the callout and pull the contents out
      -- replacing with a footnote mark. This is required because
      -- if the footnote stays in the callout, the footnote text
      -- will not appear at the bottom of the document but will instead
      -- appear in the callout itself (at the bottom)
      -- 
      -- Also note whether the footnotes contain codeblocks, which
      -- require special handling
      local hasVerbatimInNotes = false
      local noteContents = {}
      local nodeContent = node.content:walk({
        Note = function(el)
          tappend(noteContents, {el.content})
          el.content:walk({
            CodeBlock = function(el)
              hasVerbatimInNotes = true
            end
          })
          return pandoc.RawInline('latex', '\\footnotemark{}')
        end
      })
    
      -- generate the callout box
      local callout
      if calloutAppearance == constants.kCalloutAppearanceDefault then
        if title == nil then
          title = displayName(type)
        else
          title = pandoc.write(pandoc.Pandoc(title), 'latex')
        end
        callout = latexCalloutBoxDefault(title, type, icon)
      else
        callout = latexCalloutBoxSimple(title, type, icon)
      end
      local beginEnvironment = callout.beginInlines
      local endEnvironment = callout.endInlines
      local calloutContents = callout.contents
      if calloutContents == nil then
        calloutContents = pandoc.List({})
      end
    
      if lua_type(nodeContent) == "table" then
        tappend(calloutContents, nodeContent)
      else
        table.insert(calloutContents, nodeContent)
      end
    
      if calloutContents[1] ~= nil and calloutContents[1].t == "Para" and calloutContents[#calloutContents].t == "Para" then
        tprepend(calloutContents, { pandoc.Plain(beginEnvironment) })
        tappend(calloutContents, { pandoc.Plain(endEnvironment) })
      else
        tprepend(calloutContents, { pandoc.Para(beginEnvironment) })
        tappend(calloutContents, { pandoc.Para(endEnvironment) })
      end
    
      
      -- For any footnote content that was pulled out, append a footnotetext
      -- that include the contents
      for _i, v in ipairs(noteContents) do
        -- If there are paragraphs, just attach to them when possible
        if v[1].t == "Para" then
          table.insert(v[1].content, 1, pandoc.RawInline('latex', '\\footnotetext{'))
        else
          v:insert(1, pandoc.RawInline('latex', '\\footnotetext{'))
        end
          
        if v[#v].t == "Para" then
          table.insert(v[#v].content, pandoc.RawInline('latex', '}'))
        else
          v:extend({pandoc.RawInline('latex', '}')})
        end
        tappend(calloutContents, v)
      end 
    
      -- Enable fancyvrb if verbatim appears in the footnotes
      if hasVerbatimInNotes then
        quarto.doc.use_latex_package('fancyvrb')
        quarto.doc.include_text('in-header', '\\VerbatimFootnotes')
      end
      
      return pandoc.Div(calloutContents)
    end    
  }
end