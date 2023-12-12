-- latex.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to LaTeX

local constants = require("modules/constants")

local callout_counters = {}

local function ensure_callout_counter(ref)
  if callout_counters[ref] ~= nil then
    return
  end
  -- \newcounter{quartocalloutnotno}
  -- \newcommand{\quartocalloutnot}[1]{\refstepcounter{calloutnoteno}\label{#1}}

  callout_counters[ref] = true
  local crossref_info = crossref.categories.by_ref_type[ref]
  local counter_name = 'quartocallout' .. crossref_info.ref_type .. 'no'
  local counter_command_name = 'quartocallout' .. crossref_info.ref_type
  local newcounter = '\\newcounter{quartocallout' .. ref .. 'no}'
  local newcommand = '\\newcommand{\\' .. counter_command_name .. '}[1]{\\refstepcounter{' .. counter_name .. '}\\label{#1}}'

  quarto.doc.include_text('in-header', newcounter)
  quarto.doc.include_text('in-header', newcommand)
end

function latexCalloutBoxDefault(title, callout_type, icon, callout) 

  -- callout dimensions
  local leftBorderWidth = '.75mm'
  local borderWidth = '.15mm'
  local borderRadius = '.35mm'
  local leftPad = '2mm'
  local color = latexColorForType(callout_type)
  local frameColor = latexFrameColorForType(callout_type)

  local iconForType = iconForType(callout_type)

  local calloutContents = pandoc.List({});

  if is_valid_ref_type(refType(callout.attr.identifier)) then
    local ref = refType(callout.attr.identifier)
    local crossref_info = crossref.categories.by_ref_type[ref]
    -- ensure that front matter includes the correct new counter types
    ensure_callout_counter(ref)

    local delim = ""
    if title:len() > 0 then
       delim = pandoc.utils.stringify(titleDelim())
    end
    title = crossref_info.prefix .. " \\ref*{" .. callout.attr.identifier .. "}" .. delim .. " " .. title
    calloutContents:insert(pandoc.RawInline('latex', '\\quartocallout' .. crossref_info.ref_type .. '{' .. callout.attr.identifier .. '} '))
  end

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

  -- the inlines
  return { 
    contents = calloutContents,
    beginInlines = beginInlines, 
    endInlines = endInlines
  }

end

-- create the tcolorBox
function latexCalloutBoxSimple(title, type, icon, callout)

  -- callout dimensions
  local leftBorderWidth = '.75mm'
  local borderWidth = '.15mm'
  local borderRadius = '.35mm'
  local leftPad = '2mm'
  local color = latexColorForType(type)
  local colorFrame = latexFrameColorForType(type)

  if title == nil then
    title = ""
  else
    title = pandoc.write(pandoc.Pandoc(title), 'latex')
  end
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

  -- Add the titles and contents
  local calloutContents = pandoc.List({});

  if is_valid_ref_type(refType(callout.attr.identifier)) then
    local ref = refType(callout.attr.identifier)
    local crossref_info = crossref.categories.by_ref_type[ref]
    -- ensure that front matter includes the correct new counter types
    ensure_callout_counter(ref)

    local delim = ""
    if title:len() > 0 then
       delim = pandoc.utils.stringify(titleDelim())
    end
    title = crossref_info.prefix .. " \\ref*{" .. callout.attr.identifier .. "}" .. delim .. " " .. title
    calloutContents:insert(pandoc.RawInline('latex', '\\quartocallout' .. crossref_info.ref_type .. '{' .. callout.attr.identifier .. '} '))
  end

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

  if title:len() > 0 then 
    -- TODO use a better spacing rule
    title = '\\vspace{-3mm}\\textbf{' .. title .. '}\\vspace{3mm}'
    calloutContents:insert(pandoc.RawInline('latex', title))
  end

  -- the inlines
  return { 
    contents = calloutContents,
    beginInlines = beginInlines, 
    endInlines = endInlines
  }
end

function render_latex()
  if not _quarto.format.isLatexOutput() then
    return {}
  end

  -- renders the outermost element with .column-margin inside
  -- as a marginnote environment, but don't nest marginnote environments
  -- This works because it's a topdown traversal
  local function column_margin(el)
    local function strip_class(el)
      if el.classes == nil then
        return nil
      end
      el.classes = el.classes:filter(function(clz)
        return clz ~= "column-margin"
      end)
      return el
    end
    if el.classes:includes("column-margin") then
      noteHasColumns()
      local is_block = pandoc.utils.type(el) == "Block"
      el.content = _quarto.ast.walk(el.content, {
        Block = strip_class,
        Inline = strip_class
      })      
      tprepend(el.content, {latexBeginSidenote(is_block)})
      tappend(el.content, {latexEndSidenote(el, is_block)})
      return el, false
    end
  end

  local function handle_panel_layout(panel)
    panel.rows = _quarto.ast.walk(panel.rows, {
      FloatRefTarget = function(float)
        if float.attributes["ref-parent"] == nil then
          -- we're about to mess up here, force a [H] position
          local ref = refType(float.identifier)
          if ref == nil then
            -- don't know what to do with this
            -- give up
            return nil
          end
          float.attributes[ref .. "-pos"] = "H"
          return float
        end
      end,
      Figure = function(figure)
        if figure.identifier ~= nil then
          local ref = refType(figure.identifier) or "fig"
          figure.attributes[ref .. "-pos"] = "H"
        end
        return figure
      end
    })
  end

  return {
    traverse = "topdown",
    Div = column_margin,
    Span = column_margin,
    PanelLayout = handle_panel_layout,
    
    -- Pandoc emits longtable environments by default;
    -- longtable environments increment the _table_ counter (!!)
    -- https://mirror2.sandyriver.net/pub/ctan/macros/latex/required/tools/longtable.pdf 
    -- (page 13, definition of \LT@array)
    --
    -- This causes double counting in our table environments. Our solution
    -- is to decrement the counter manually after each longtable environment.
    -- 
    -- This hack causes some warning during the compilation of the latex document,
    -- but the alternative is worse.
    FloatRefTarget = function(float)
      -- don't look inside floats, they get their own rendering.
      if float.type == "Table" then
        -- we have a separate fixup for longtables in our floatreftarget renderer
        -- in the case of subfloat tables...
        float.content = _quarto.ast.walk(quarto.utils.as_blocks(float.content), {
          traverse = "topdown",
          FloatRefTarget = function(float)
            return nil, false
          end,
        })
      end
      float.content = _quarto.ast.walk(quarto.utils.as_blocks(float.content), {
        PanelLayout = function(panel)
          panel.attributes["fig-pos"] = "H"
          return panel
        end 
      })
      return float, false
    end,
    Image = function(img)
      if img.classes:includes("column-margin") then
        return column_margin(pandoc.Span(img, img.attr))
      end
      local align = attribute(img, kFigAlign, nil) or attribute(img, kLayoutAlign, nil)
      if align == nil then
        return nil
      end
      img.attributes[kFigAlign] = nil
      -- \\centering doesn't work consistently here...
      return pandoc.Inlines({
        pandoc.RawInline('latex', '\\begin{center}\n'),
        img,
        pandoc.RawInline('latex', '\n\\end{center}\n')
      })
    end,
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
      local lifted_contents = pandoc.Blocks({})

      local nodeContent = _quarto.ast.walk(node.content, {
        traverse = "topdown",
        FloatRefTarget = function(float, float_node)
          if float.identifier ~= nil then
            local ref = refType(float.identifier)
            if ref ~= nil then
              float.attributes[ref .. "-pos"] = "H"
              return float
            end
          end
        end,
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
        callout = latexCalloutBoxDefault(title, type, icon, node)
      else
        callout = latexCalloutBoxSimple(title, type, icon, node)
      end
      local beginEnvironment = callout.beginInlines
      local endEnvironment = callout.endInlines
      local calloutContents = callout.contents
      if calloutContents == nil then
        calloutContents = pandoc.Blocks({})
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

      calloutContents:extend(lifted_contents)
    
      -- Enable fancyvrb if verbatim appears in the footnotes
      if hasVerbatimInNotes then
        quarto.doc.use_latex_package('fancyvrb')
        quarto.doc.include_text('in-header', '\\VerbatimFootnotes')
      end
      
      return pandoc.Div(calloutContents)
    end,
    Note = function(n)
      if marginReferences() then
        -- This is to support multiple paragraphs in footnotes in margin as sidenotes CTAN has some issue (quarto-dev/quarto-cli#7534)
        n.content = pandoc.Para(pandoc.utils.blocks_to_inlines(n.content, {pandoc.RawInline('latex', '\n\\endgraf\n')}))
        return n
      end
    end
  }
end


function render_latex_fixups()
  if not _quarto.format.isLatexOutput() then
    return {}
  end

  return {
    RawBlock = function(raw)
      if _quarto.format.isRawLatex(raw) then
        if (raw.text:match(_quarto.patterns.latexLongtablePattern) and
            not raw.text:match(_quarto.patterns.latexCaptionPattern)) then
          raw.text = raw.text:gsub(
            _quarto.patterns.latexLongtablePattern, "\\begin{longtable*}%2\\end{longtable*}", 1)
          return raw
        end
      end
    end
  }
end
