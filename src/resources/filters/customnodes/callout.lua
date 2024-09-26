-- callout.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function _callout_main()
  local function calloutType(div)
    for _, class in ipairs(div.attr.classes) do
      if _quarto.modules.classpredicates.isCallout(class) then 
        local type = class:match("^callout%-(.*)")
        if type == nil then
          type = "none"
        end
        return type
      end
    end
    return nil
  end

  local function nameForCalloutStyle(calloutType)
    if calloutType == nil then
      return "default"
    else 
      local name = pandoc.utils.stringify(calloutType)
  
      if name:lower() == "minimal" then
        return "minimal"
      elseif name:lower() == "simple" then
        return "simple"
      else
        return "default"
      end
    end
  end

  _quarto.ast.add_handler({
    -- use either string or array of strings
    class_name = { "callout", "callout-note", "callout-warning", "callout-important", "callout-caution", "callout-tip" },
  
    -- the name of the ast node, used as a key in extended ast filter tables
    ast_name = "Callout",
  
    -- callouts will be rendered as blocks
    kind = "Block",
  
    -- a function that takes the div node as supplied in user markdown
    -- and returns the custom node
    parse = function(div)
      quarto_global_state.hasCallouts = true
      local title = string_to_quarto_ast_inlines(div.attr.attributes["title"] or "")
      if not title or #title == 0 then
        title = resolveHeadingCaption(div)
      end
      local old_attr = div.attr
      local appearanceRaw = div.attr.attributes["appearance"]
      local icon = div.attr.attributes["icon"]
      local collapse = div.attr.attributes["collapse"]
      div.attr.attributes["appearance"] = nil
      div.attr.attributes["collapse"] = nil
      div.attr.attributes["icon"] = nil
      local callout_type = calloutType(div)
      div.attr.classes = div.attr.classes:filter(function(class) return not _quarto.modules.classpredicates.isCallout(class) end)
      return quarto.Callout({
        appearance = appearanceRaw,
        title = title,
        collapse = collapse,
        content = div.content,
        icon = icon,
        type = callout_type,
        attr = old_attr,
      })
    end,
  
    -- These fields will be stored in the extended ast node
    -- and available in the object passed to the custom filters
    -- They must store Pandoc AST data. "Inline" custom nodes
    -- can store Inlines in these fields, "Block" custom nodes
    -- can store Blocks (and hence also Inlines implicitly).
    slots = { "title", "content" },
  
    constructor = function(tbl)
      quarto_global_state.hasCallouts = true
  
      local t = tbl.type
      local iconDefault = true
      local appearanceDefault = nil
      if t == "none" then
        iconDefault = false
        appearanceDefault = "simple"
      end
      local appearanceRaw = tbl.appearance
      if appearanceRaw == nil then
        appearanceRaw = option("callout-appearance", appearanceDefault)
      end
  
      local icon = tbl.icon
      if icon == nil then
        icon = option("callout-icon", iconDefault)
      elseif icon == "false" then
        icon = false
      end
  
      local appearance = nameForCalloutStyle(appearanceRaw);
      if appearance == "minimal" then
        icon = false
        appearance = "simple"
      end
      local content = pandoc.Blocks({})
      content:extend(quarto.utils.as_blocks(tbl.content))
      local title = tbl.title
      if type(title) == "string" then
        title = pandoc.Str(title)
      end
      return {
        title = title,
        collapse = tbl.collapse,
        content = content,
        appearance = appearance,
        icon = icon,
        type = t,
        attr = tbl.attr or pandoc.Attr(),
      }
    end
  })

  -- default renderer first
  _quarto.ast.add_renderer("Callout", function(_)
    return true
  end, function(node)
    node = _quarto.modules.callouts.decorate_callout_title_with_crossref(node)
    local contents = _quarto.modules.callouts.resolveCalloutContents(node, true)
    local callout = pandoc.BlockQuote(contents)
    local result = pandoc.Div(callout, pandoc.Attr(node.attr.identifier or ""))
    return result
  end)

  _quarto.ast.add_renderer("Callout", function(_)
    return _quarto.format.isHtmlOutput() and hasBootstrap()
  end, _quarto.modules.callouts.render_to_bootstrap_div)
  
  _quarto.ast.add_renderer("Callout", function(_) 
    return _quarto.format.isEpubOutput() or _quarto.format.isRevealJsOutput()
  end, function (node)
    node = _quarto.modules.callouts.decorate_callout_title_with_crossref(node)
    local title = quarto.utils.as_inlines(node.title)
    local type = node.type
    local calloutAppearance = node.appearance
    local hasIcon = node.icon
  
    if calloutAppearance == _quarto.modules.constants.kCalloutAppearanceDefault and pandoc.utils.stringify(title) == "" then
      title = _quarto.modules.callouts.displayName(type)
    end
    
    -- the body of the callout
    local calloutBody = pandoc.Div({}, pandoc.Attr("", {"callout-body"}))
  
    local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon'></i>")});       
    local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));
  
    -- title
    if title ~= nil and (pandoc.utils.type(title) == "string" or next(title) ~= nil) then
      local callout_title = pandoc.Div({}, pandoc.Attr("", {"callout-title"}))
      if hasIcon then
        callout_title.content:insert(imgDiv)
      end
      callout_title.content:insert(pandoc.Para(pandoc.Strong(title)))
      calloutBody.content:insert(callout_title)
    else 
      if hasIcon then
        calloutBody.content:insert(imgDiv)
      end
    end
  
    -- contents 
    local calloutContents = pandoc.Div(node.content or pandoc.Blocks({}), pandoc.Attr("", {"callout-content"}))
    calloutBody.content:insert(calloutContents)
  
    -- set attributes (including hiding icon)
    local attributes = pandoc.List({"callout"})
    if type ~= nil then
      attributes:insert("callout-" .. type)
    end
  
    if hasIcon == false then
      attributes:insert("no-icon")
    end
    if title ~= nil and (pandoc.utils.type(title) == "string" or next(title) ~= nil) then
      attributes:insert("callout-titled")
    end
    attributes:insert("callout-style-" .. calloutAppearance)
  
    local result = pandoc.Div({ calloutBody }, pandoc.Attr(node.attr.identifier or "", attributes))
    -- in revealjs or epub, if the leftover attr is non-trivial, 
    -- then we need to wrap the callout in a div (#5208, #6853)
    if node.attr.identifier ~= "" or #node.attr.classes > 0 or #node.attr.attributes > 0 then
      return pandoc.Div({ result }, node.attr)
    else
      return result
    end
  end)

  _quarto.ast.add_renderer("Callout", function(_)
    return _quarto.format.isGithubMarkdownOutput()
  end, function(callout)
    local result = pandoc.Blocks({})
    local header = "[!" .. callout.type:upper() .. "]"
    result:insert(pandoc.RawBlock("markdown", header))
    local tt = pandoc.utils.type(callout.title)
    if tt ~= "nil" then 
      result:insert(pandoc.Header(3, quarto.utils.as_inlines(callout.title)))
    end
    local ct = pandoc.utils.type(callout.content)
    if ct == "Block" then
      result:insert(callout.content)
    elseif ct == "Blocks" then
      result:extend(callout.content)
    else
      internal_error()
    end
    return pandoc.BlockQuote(result)
  end)

  local included_font_awesome = false
  local function ensure_typst_font_awesome()
    if included_font_awesome then
      return
    end
    included_font_awesome = true
    quarto.doc.include_text("in-header", "#import \"@preview/fontawesome:0.1.0\": *")
  end

  _quarto.ast.add_renderer("Callout", function(_)
    return _quarto.format.isTypstOutput()
  end, function(callout)
    ensure_typst_font_awesome()

    local callout_theme_color_map = {
      note = "primary",
      warning = "warning",
      important = "danger",
      tip = "success",
      caution = nil -- ?
    }

    local attrs = _quarto.modules.callouts.callout_attrs[callout.type]
    local background_color, icon_color, icon
    if attrs == nil then
      background_color = "white"
      icon_color = "black"
      icon = "fa-info"
    else
      background_color = "rgb(\"#" .. attrs.background_color .. "\")";
      icon_color = "rgb(\"#" .. attrs.color .. "\")";
      icon = attrs.fa_icon_typst
    end
    local brand = param("brand")
    if brand then
      local color = brand.processedData and brand.processedData.color
      if color and callout_theme_color_map[callout.type] and
          color[callout_theme_color_map[callout.type]] then
        background_color =  "brand-color-background." .. callout_theme_color_map[callout.type]
        icon_color = "brand-color." .. callout_theme_color_map[callout.type]
      end
    end
    if callout.attr.identifier == "" then
      return _quarto.format.typst.function_call("callout", { 
        { "body", _quarto.format.typst.as_typst_content(callout.content) },
        { "title", _quarto.format.typst.as_typst_content(
          callout.title or pandoc.Plain(_quarto.modules.callouts.displayName(callout.type))
        )},
        { "background_color", pandoc.RawInline("typst", background_color) },
        { "icon_color", pandoc.RawInline("typst", icon_color) },
        { "icon", pandoc.RawInline("typst", "" .. icon .. "()")}
      })
    end

    local typst_callout = _quarto.format.typst.function_call("callout", { 
      { "body", _quarto.format.typst.as_typst_content(callout.content) },
      { "title", _quarto.format.typst.as_typst_content(callout.title, "inlines")
       },
      { "background_color", pandoc.RawInline("typst", background_color) },
      { "icon_color", pandoc.RawInline("typst", icon_color) },
      { "icon", pandoc.RawInline("typst", "" .. icon .. "()")}
    })

    local category = crossref.categories.by_ref_type[refType(callout.attr.identifier)]
    return make_typst_figure {
      content = typst_callout,
      caption_location = "top",
      caption = pandoc.Plain(pandoc.Str("")),
      kind = "quarto-callout-" .. _quarto.modules.callouts.displayName(callout.type),
      supplement = param("crossref-" .. callout.type .. "-prefix") or category.name,
      numbering = "1",
      identifier = callout.attr.identifier
    }
  end)

  _quarto.ast.add_renderer("Callout", function(_)
    return _quarto.format.isDocxOutput()
  end, function(callout)
    return calloutDocx(callout)
  end)
end
_callout_main()

function docx_callout_and_table_fixup() 
  if not _quarto.format.isDocxOutput() then
    return {}
  end

  -- Attempts to detect whether this element is a code cell
  -- whose output is a table
  local function isCodeCellTable(el) 
    local isTable = false
    _quarto.ast.walk(el, {
      Div = function(div)
        if div.attr.classes:find_if(_quarto.modules.classpredicates.isCodeCellDisplay) then
          _quarto.ast.walk(div, {
            Table = function(tbl)
              isTable = true
            end
          })
        end
      end
    })
    return isTable
  end

  local function isCodeCellFigure(el)
    local isFigure = false
    _quarto.ast.walk(el, {
      Div = function(div)
        if div.attr.classes:find_if(_quarto.modules.classpredicates.isCodeCellDisplay) then
          if (isFigureDiv(div)) then
            isFigure = true
          elseif div.content and #div.content > 0 then 
            isFigure = discoverFigure(div.content[1], true) ~= nil
          end
        end
      end
    })
    return isFigure
  end

  return {
  
    -- Insert paragraphs between consecutive callouts or tables for docx
    Blocks = function(blocks)
      local lastWasCallout = false
      local lastWasTableOrFigure = false
      local newBlocks = pandoc.Blocks({})
      for i,el in ipairs(blocks) do 
        -- determine what this block is
        local isCallout = is_custom_node(el, "Callout")
        local isTableOrFigure = is_custom_node(el, "FloatRefTarget") or el.t == "Table" or isFigureDiv(el) or (discoverFigure(el, true) ~= nil)
        local isCodeBlock = el.t == "CodeBlock"

        -- Determine whether this is a code cell that outputs a table
        local isCodeCell = is_regular_node(el, "Div") and el.attr.classes:find_if(_quarto.modules.classpredicates.isCodeCell)
        if isCodeCell and (isCodeCellTable(el) or isCodeCellFigure(el)) then 
          isTableOrFigure = true
        end
        
        -- insert spacer if appropriate
        local insertSpacer = false
        if isCallout and (lastWasCallout or lastWasTableOrFigure) then
          insertSpacer = true
        end
        if isCodeBlock and lastWasCallout then
          insertSpacer = true
        end
        if isTableOrFigure and lastWasTableOrFigure then
          insertSpacer = true
        end

        if insertSpacer then
          newBlocks:insert(pandoc.Para(stringToInlines(" ")))
        end

        -- always insert
        newBlocks:insert(el)

        -- record last state
        lastWasCallout = isCallout
        lastWasTableOrFigure = isTableOrFigure
      end

      if #newBlocks > #blocks then
        return newBlocks
      else
        return nil
      end
    end

  }
end

function crossref_callouts()
  return {
    Callout = function(callout)
      local type = refType(callout.attr.identifier)
      if type == nil or not is_valid_ref_type(type) then
        return nil
      end
      local label = callout.attr.identifier
      local title = quarto.utils.as_blocks(callout.title)
      callout.order = add_crossref(label, type, title)
      return callout
    end
  }
end