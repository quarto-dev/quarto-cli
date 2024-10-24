-- latex.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to LaTeX

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
  title = title or ""

  -- callout dimensions
  local leftBorderWidth = '.75mm'
  local borderWidth = '.15mm'
  local borderRadius = '.35mm'
  local leftPad = '2mm'
  local color = _quarto.modules.callouts.latexColorForType(callout_type)
  local display_title = _quarto.modules.callouts.displayName(callout_type)
  local frameColor = _quarto.modules.callouts.latexFrameColorForType(callout_type)

  local iconForType = _quarto.modules.callouts.iconForType(callout_type)

  local calloutContents = pandoc.List({})

  if is_valid_ref_type(refType(callout.attr.identifier)) then
    local ref = refType(callout.attr.identifier)
    local crossref_info = crossref.categories.by_ref_type[ref]
    -- ensure that front matter includes the correct new counter types
    ensure_callout_counter(ref)

    local suffix = ""
    if title:len() > 0 then
       suffix = pandoc.utils.stringify(titleDelim()) .. " " .. title
    end
    title = display_title .. " \\ref*{" .. callout.attr.identifier .. "}" .. suffix
    calloutContents:insert(pandoc.RawInline('latex', '\\quartocallout' .. crossref_info.ref_type .. '{' .. callout.attr.identifier .. '} '))
  else
    if title:len() > 0 then
      title = title
    else
      title = display_title
    end
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
  local color = _quarto.modules.callouts.latexColorForType(type)
  local colorFrame = _quarto.modules.callouts.latexFrameColorForType(type)

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
  local iconForCat = _quarto.modules.callouts.iconForType(type)
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

  function beginColumnComment() 
    return pandoc.RawBlock("latex", "% quarto-tables-in-margin-AB1927C9:begin")
  end
  
  function endColumnComment() 
    return pandoc.RawBlock("latex", "% quarto-tables-in-margin-AB1927C9:end")
  end
  
  function handle_table_columns(table)
    local useMargin = table.classes:find_if(isStarEnv)
    if useMargin then
      return {
        beginColumnComment(),
        table,
      endColumnComment()
      }
    end
    if table.classes:includes("render-as-tabular") then
      return latexTabular(table)
    end
  end
  

  -- renders the outermost element with .column-margin inside
  -- as a marginnote environment, but don't nest marginnote environments
  -- This works because it's a topdown traversal
  local function handle_column_classes(el)
    local function strip(content, class)
      local function strip_class(inner_el)
        if inner_el.classes == nil then
          return nil
        end
        inner_el.classes = inner_el.classes:filter(function(clz)
          return clz ~= class
        end)
        return inner_el
      end
      return _quarto.ast.walk(content, {
        Block = strip_class,
        Inline = strip_class
      })
    end
    if el.classes:includes("column-margin") then
      noteHasColumns()
      local is_block = pandoc.utils.type(el) == "Block"
      el.content = strip(el.content, "column-margin")
      local found_table = false
      local found_something_else = false
      local function tag_something_else()
        found_something_else = true
      end
      el = _quarto.ast.walk(el, {
        traverse = "topdown",
        Block = found_something_else,
        Inline = found_something_else,
        Table = function(t)
          local result = handle_table_columns(t)
          found_table = true
          return result,false
        end
      }) or pandoc.Div({}) -- unnecessary, but the type checker doesn't know

      if found_table and found_something_else then
        warn("Cannot mix tables and other content in a column-margin environment. Results may be unpredictable.")
      end
      if not found_table then
        -- marginnote doesn't work well with margintable
        -- so we only add marginnote if there's no table
        tprepend(el.content, {latexBeginSidenote(is_block)})
        tappend(el.content, {latexEndSidenote(el, is_block)})
      end
      return el, false
    else
      local f = el.classes:find_if(isStarEnv)
      if f ~= nil then
        noteHasColumns()
        el.content = strip(el.content, f)
        tprepend(el.content, {pandoc.RawBlock("latex", "\\begin{figure*}[H]")})
        tappend(el.content, {pandoc.RawBlock("latex", "\\end{figure*}")})
        return el, false
      end
    end
  end

  local function handle_panel_layout(panel)
    panel.rows = _quarto.ast.walk(panel.rows, {
      FloatRefTarget = function(float)
        if float.attributes["ref-parent"] == nil then
          -- we're about to mess up here, force a [H] position
          local ref = ref_type_from_float(float)
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
    Div = handle_column_classes,
    Span = handle_column_classes,
    Table = handle_table_columns,
    PanelLayout = handle_panel_layout,
    
    -- Pandoc emits longtable environments by default;
    -- longtable environments increment the _table_ counter (!!)
    -- http://mirrors.ctan.org/macros/latex/required/tools/longtable.pdf 
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
      elseif float.type == "Listing" then
        float.content = _quarto.ast.walk(float.content, {
          traverse = "topdown",
          -- A Listing float with a decoratedcodeblock inside it needs
          -- to be deconstructed
          DecoratedCodeBlock = function(block)
            if block.filename ~= nil then
              if float.caption_long == nil then
                float.caption_long = pandoc.Div({})
              end
              float.caption_long.content:insert(1, pandoc.Space())
              float.caption_long.content:insert(1, pandoc.Code(block.filename))
            end
            return block.code_block
          end
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
        return handle_column_classes(pandoc.Span(img, img.attr))
      end
      local align = attribute(img, kFigAlign, nil) or attribute(img, kLayoutAlign, nil)
      if align == nil then
        return nil
      end
      img.attributes[kFigAlign] = nil

      if align == "left" then
        return pandoc.Inlines({
          img,
          pandoc.RawInline('latex', '\\hfill\n'),
        })
      elseif align == "right" then
        return pandoc.Inlines({
          pandoc.RawInline('latex', '\\hfill\n'),
          img,
        })
      else
        -- \\centering doesn't work consistently here...
        return pandoc.Inlines({
          pandoc.RawInline('latex', '\\begin{center}\n'),
          img,
          pandoc.RawInline('latex', '\n\\end{center}\n')
        })
      end
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
            local ref = ref_type_from_float(float)
            if ref ~= nil then
              float.attributes[ref .. "-pos"] = "H"
              return float
            end
          end
        end,
        Note = function(el)
          tappend(noteContents, {el.content})
          _quarto.modules.jog(el.content, {
            CodeBlock = function(el)
              hasVerbatimInNotes = true
            end
          })
          return pandoc.RawInline('latex', '\\footnotemark{}')
        end
      })
    
      -- generate the callout box
      local callout
      if calloutAppearance == _quarto.modules.constants.kCalloutAppearanceDefault then
        if title ~= nil then
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
  local hex_to_rgb = function(hex)
    local r = tonumber(hex:sub(2, 3), 16) / 255
    local g = tonumber(hex:sub(4, 5), 16) / 255
    local b = tonumber(hex:sub(6, 7), 16) / 255
    return ("{rgb}{%.2f,%.2f,%.2f}"):format(r, g, b)
  end

  local n_emitted_colors = 0
  local emitted_colors = {}
  local need_inject = false

  local function emit_color(code)
    need_inject = true
    local n = emitted_colors[code]
    if n == nil then
      n_emitted_colors = n_emitted_colors + 1
      emitted_colors[code] = n_emitted_colors
      n = n_emitted_colors
    end
    return "{QuartoInternalColor" .. n .. "}"
  end
  -- these are currently copied from _quarto-rules.scss
  -- which itself copies from IPython's ansi color scheme
  -- TODO we should allow users to customize these
  local dark_ansi_fg_colors = {
    [30] = hex_to_rgb("#282c36"),
    [31] = hex_to_rgb("#b22b31"),
    [32] = hex_to_rgb("#007427"),
    [33] = hex_to_rgb("#b27d12"),
    [34] = hex_to_rgb("#0065ca"),
    [35] = hex_to_rgb("#a03196"),
    [36] = hex_to_rgb("#258f8f"),
    [37] = hex_to_rgb("#a1a6b2"),
  }
  local bright_ansi_fg_colors = {
    [30] = hex_to_rgb("#3e424d"),
    [31] = hex_to_rgb("#e75c58"),
    [32] = hex_to_rgb("#00a250"),
    [33] = hex_to_rgb("#208ffb"),
    [34] = hex_to_rgb("#ddb62b"),
    [35] = hex_to_rgb("#d160c4"),
    [36] = hex_to_rgb("#60c6c8"),
    [37] = hex_to_rgb("#c5c1b4"),
  }
  local function emit_quarto_ansi_color(n)
    local vs = pandoc.List(split(n, ";")):map(function (v) return tonumber(v) or 0 end)
    if #vs == 0 then
      return emit_color("{rgb}{0,0,0}")
    elseif #vs == 1 then
      return emit_color(dark_ansi_fg_colors[vs[1]] or "{rgb}{0,0,0}")
    elseif #vs == 2 then
      if vs[1] == 0 then
        return emit_color(dark_ansi_fg_colors[vs[2]] or "{rgb}{0,0,0}")
      elseif vs[1] == 1 then
        return emit_color(bright_ansi_fg_colors[vs[2]] or "{rgb}{0,0,0}")
      else
        return emit_color("{rgb}{0,0,0}")
      end
    else
      -- here we'll ignore the 4th entry in 38,5,color,??? codes
      -- because we don't know what to do with it
      if vs[1] == 38 and vs[2] == 5 then
        local color = vs[3]
        if color >= 0 and color <= 7 then
          return emit_color(dark_ansi_fg_colors[color + 23] or "{rgb}{0,0,0}")
        elseif color >= 8 and color <= 15 then
          return emit_color(bright_ansi_fg_colors[color + 15] or "{rgb}{0,0,0}")
        elseif color >= 16 and color <= 231 then
          local r = math.floor((color - 16) / 36)
          local g = math.floor(((color - 16) % 36) / 6)
          local b = (color - 16) % 6
          return emit_color(("{rgb}{%.2f,%.2f,%.2f}"):format(r / 5, g / 5, b / 5))
        elseif color >= 232 and color <= 255 then
          local v = (color - 232) * 10 + 8
          return emit_color(("{rgb}{%.2f,%.2f,%.2f}"):format(v / 255, v / 255, v / 255))
        end
      end
      print("Unknown ANSI color code: " .. n)
      return emit_color("{rgb}{0,0,0}")
    end
  end
  return {
    Meta = function(meta)
      if not need_inject then
        return
      end
      metaInjectLatex(meta, function(inject)
        for v, i in pairs(emitted_colors) do
          local def = "\\definecolor{QuartoInternalColor" .. i .. "}" .. v
          inject(def)
        end
      end)
      return meta
    end,
    RawBlock = function(raw)
      if _quarto.format.isRawLatex(raw) then
        local long_table_match = _quarto.modules.patterns.match_all_in_table(_quarto.patterns.latexLongtablePattern)
        local caption_match = _quarto.modules.patterns.match_all_in_table(_quarto.patterns.latexCaptionPattern)
        if long_table_match(raw.text) and not caption_match(raw.text) then
          raw.text = raw.text:gsub(
            _quarto.modules.patterns.combine_patterns(_quarto.patterns.latexLongtablePattern), "\\begin{longtable*}%2\\end{longtable*}", 1)
          return raw
        end
      end
    end,
    CodeBlock = function(code)
      if code.text:match("\027%[[0-9;]+m") and #code.classes == 0 then
        local lines = split(code.text, "\n")
        local new_lines = pandoc.List({
          '\\begin{Highlighting}'
        })
        local cur_color = "\\textcolor{black}"
        for _, line in ipairs(lines) do
          local start_color = cur_color
          line = line:gsub("\027%[([0-9;]+)m", function(n)
            local this_color = "\\textcolor" .. emit_quarto_ansi_color(n)
            cur_color = this_color
            return "}" .. this_color .. "{"
          end)
          line = start_color .. "{" .. line .. "}"
          new_lines:insert(line)
        end
        new_lines:insert('\\end{Highlighting}')
        return pandoc.RawBlock('latex', table.concat(new_lines, "\n"))
      end
    end
  }
end
