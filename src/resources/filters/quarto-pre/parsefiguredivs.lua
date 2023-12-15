-- parsefiguredivs.lua
-- Copyright (C) 2023 Posit Software, PBC

local patterns = require("modules/patterns")

local function process_div_caption_classes(div)
  -- knitr forwards "cap-location: top" as `.caption-top`...
  -- and in that case we don't know if it's a fig- or a tbl- :facepalm:
  -- so we have to use cap-locatin generically in the attribute
  if div.classes:find_if(
    function(class) return class:match("caption%-.+") end) then
    local matching_classes = div.classes:filter(function(class)
      return class:match("caption%-.+")
    end)
    div.classes = div.classes:filter(function(class)
      return not class:match("caption%-.+")
    end)
    for i, c in ipairs(matching_classes) do
      div.attributes["cap-location"] = c:match("caption%-(.+)")
    end
    return true
  end
  return false
end

local function coalesce_code_blocks(content)
  local result = pandoc.Blocks({})
  local state = "start"
  for _, element in ipairs(content) do
    if state == "start" then
      if is_regular_node(element, "CodeBlock") then
        state = "coalescing"
      end
      result:insert(element)
    elseif state == "coalescing" then
      if is_regular_node(element, "CodeBlock") and result[#result].attr == element.attr then
        result[#result].text = result[#result].text .. "\n" .. element.text
      else
        state = "start"
        result:insert(element)
      end
    end
  end
  return result
end

local function remove_latex_crossref_envs(content, name)
  if name == "Table" then
    return _quarto.ast.walk(content, {
      RawBlock = function(raw)
        if not _quarto.format.isRawLatex(raw) then
          return nil
        end
        local b, e, begin_table, table_body, end_table = raw.text:find(patterns.latex_table)
        if b ~= nil then
          raw.text = table_body
          return raw
        else
          return nil
        end
      end
    })
  end
  return content
end

local function kable_raw_latex_fixups(content, identifier)
  local matches = 0

  content = _quarto.ast.walk(content, {
    RawBlock = function(raw)
      if not _quarto.format.isRawLatex(raw) then
        return nil
      end
      if raw.text:match(patterns.latex_long_table) == nil then
        return nil
      end
      local b, e, match1, label_identifier = raw.text:find(patterns.latex_label)
      if b ~= nil then
        raw.text = raw.text:sub(1, b - 1) .. raw.text:sub(e + 1)
      end
      local b, e, match2, caption_content = raw.text:find(patterns.latex_caption)
      if b ~= nil then
        raw.text = raw.text:sub(1, b - 1) .. raw.text:sub(e + 1)
      end


      if match1 == nil and match2 == nil then
        return nil
      end
      -- it's a longtable, we'll put it inside a Table FloatRefTarget
      -- if it has either a label or a caption.

      -- HACK: kable appears to emit a label that starts with "tab:"
      -- we strip this and hope for the best
      if label_identifier ~= nil then
        label_identifier = label_identifier:gsub("^tab:", "")
      end

      -- we found a table, a label, and a caption. This is a FloatRefTarget.
      matches = matches + 1
      return quarto.FloatRefTarget({
        identifier = label_identifier,
        type = "Table",
        content = pandoc.Blocks({ raw }),
        caption_long = pandoc.Blocks({pandoc.Plain(string_to_quarto_ast_inlines(caption_content))}),
      })
    end
  })

  if matches > 1 then
    -- we found more than one table, so these will become subfloats and
    -- we might need auto-identifiers (since)
    local counter = 0
    content = _quarto.ast.walk(content, {
      FloatRefTarget = function(target)
        counter = counter + 1
        if target.identifier == identifier then
          target.identifier = identifier .. "-" .. tostring(counter) 
        end
        return target
      end
    })
  end

  return matches, content
end

function parse_reftargets()
  
  local function parse_theorem_div(div)
    if has_theorem_ref(div) then
      local el = div
      -- capture then remove name
      local name = markdownToInlines(el.attr.attributes["name"])
      if not name or #name == 0 then
        name = resolveHeadingCaption(el)
      end
      el.attr.attributes["name"] = nil 
      local identifier = el.attr.identifier
      -- remove identifier to avoid infinite recursion
      el.attr.identifier = ""
      return quarto.Theorem {
        identifier = identifier,
        name = name,
        div = div
      }, false
    end
    -- local types = theorem_types
    -- local type = refType(el.attr.identifier)
    -- local theorem_type = types[type]
    -- if theorem_type then
    -- end
  end

  local function parse_float_div(div)
    process_div_caption_classes(div)
    local ref = refType(div.identifier)
    if ref == nil then
      fail("Float div without crossref identifier?")
      return
    end
    local category = crossref.categories.by_ref_type[ref]
    if category == nil then
      fail("Float with invalid crossref category? " .. div.identifier)
      return
    end
    if category.kind ~= "float" then
      return nil -- skip non-float reftargets now that they exist
    end

    local content = div.content
    local caption_attr_key = ref .. "-cap"

    -- caption location handling

    -- .*-cap-location
    local caption_location_attr_key = ref .. "-cap-location"
    local caption_location_class_pattern = ".*cap%-location%-(.*)"
    local caption_location_classes = div.classes:filter(function(class)
      return class:match(caption_location_class_pattern)
    end)

    if #caption_location_classes then
      div.classes = div.classes:filter(function(class)
        return not class:match(caption_location_class_pattern)
      end)
      for _, class in ipairs(caption_location_classes) do
        local c = class:match(caption_location_class_pattern)
        div.attributes[caption_location_attr_key] = c
      end
    end
    local caption = refCaptionFromDiv(div)
    if caption ~= nil then
      div.content:remove(#div.content)
    elseif div.attributes[caption_attr_key] ~= nil then
      caption = pandoc.Plain(string_to_quarto_ast_inlines(div.attributes[caption_attr_key]))
      div.attributes[caption_attr_key] = nil
    else
      -- it's possible that the content of this div includes a table with a caption
      -- so we'll go root around for that.
      local found_caption = false
      content = _quarto.ast.walk(content, {
        Table = function(table)
          if table.caption.long ~= nil then
            found_caption = true
            caption = table.caption.long[1] -- what if there's more than one entry here?
            table.caption.long = nil
            return table
          end
        end
      })

      -- luacov: disable
      if content == nil then
        internal_error()
        return nil
      end
      -- luacov: enable
      
      -- TODO are there other cases where we should look for captions?
      if not found_caption then
        caption = pandoc.Plain({})
      end
    end

    if caption == nil then
      return nil
    end

    local identifier = div.identifier
    local attr = pandoc.Attr(identifier, div.classes, div.attributes)
    if (#content == 1 and content[1].t == "Para" and
        content[1].content[1].t == "Image") then
      -- if the div contains a single image, then we simply use the image as
      -- the content
      content = content[1].content[1]
      attr = merge_attrs(attr, content.attr)
      attr.identifier = div.identifier -- never override the identifier
    end

    local skip_outer_reftarget = false
    if ref == "tbl" then
      -- knitr/kable/etc fixups

      -- attempt to find table and caption
      local matches
      matches, content = kable_raw_latex_fixups(content, identifier)
      skip_outer_reftarget = matches == 1
    end

    if div.classes:includes("cell") then
      local layout_classes = attr.classes:filter(
        function(c) return c:match("^column-") end
      )
      div.classes = div.classes:filter(
        function(c) return not c:match("^column-") end
      )
      if #layout_classes then
        attr.classes = attr.classes:filter(
          function(c) return not layout_classes:includes(c) end)
        -- if the div is a cell, then all layout attributes need to be
        -- forwarded to the cell .cell-output-display content divs
        content = _quarto.ast.walk(content, {
          Div = function(div)
            if div.classes:includes("cell-output-display") then
              div.classes:extend(layout_classes)
              return div
            end
          end
        })  
      end
    end

    content = remove_latex_crossref_envs(content, category.name)

    -- respect single table in latex longtable fixups above
    if skip_outer_reftarget then
      -- we also need to strip the div identifier here
      -- or we end up with duplicate identifiers which latex doesn't like
      div.identifier = ""
      div.content = content
      return div
    end

    if div.classes:includes("cell") and div.attributes["layout-ncol"] == nil then
      -- if this is a non-layout cell, we need to splice the code out of the
      -- cell-output-display div
      -- 
      -- layout cells do their own processing later

      local return_cell = pandoc.Div({})
      local final_content = pandoc.Div({})
      local found_cell_output_display = false
      for _, element in ipairs(content or {}) do
        if is_regular_node(element, "Div") and element.classes:includes("cell-output-display") then
          found_cell_output_display = true
          final_content.content:insert(element)
        else
          return_cell.content:insert(element)
        end
      end

      if found_cell_output_display then
        return_cell.content = coalesce_code_blocks(return_cell.content)
        return_cell.classes = div.classes
        return_cell.attributes = div.attributes
        local reftarget = quarto.FloatRefTarget({
          attr = attr,
          type = category.name,
          content = final_content.content,
          caption_long = {pandoc.Plain(caption.content)},
        })
        -- need to reference as a local variable because of the
        -- second return value from the constructor
        return_cell.content:insert(reftarget)
        return return_cell
      end
    end

    return quarto.FloatRefTarget({
      attr = attr,
      type = category.name,
      content = content,
      caption_long = {pandoc.Plain(caption.content)},
    }), false
  end

  return {
    traverse = "topdown",
    Figure = function(fig)
      local key_prefix = refType(fig.identifier)
      if key_prefix == nil then
        return nil
      end
      local category = crossref.categories.by_ref_type[key_prefix]
      if category == nil then
        return nil
      end
      if #fig.content ~= 1 and fig.content[1].t ~= "Plain" then
        -- we don't know how to parse this pandoc 3 figure
        -- just return as is
        return nil
      end

      local fig_attr = fig.attr
      local new_content = _quarto.ast.walk(fig.content[1], {
        Image = function(image)
          -- forward attributes and classes from the image to the float
          fig_attr = merge_attrs(fig_attr, image.attr)
          -- strip redundant image caption
          image.caption = {}
          return image
        end
      }) or fig.content[1] -- this shouldn't be needed but the lua analyzer doesn't know it

      return quarto.FloatRefTarget({
        attr = fig_attr,
        type = category.name,
        content = new_content.content,
        caption_long = fig.caption.long,
        caption_short = fig.caption.short,
      }), false
    end,

    -- if we see a table with a caption that includes a tbl- label, then
    -- we normalize that to a FloatRefTarget
    Table = function(el)
      if el.caption.long == nil then
        return nil
      end
      local last = el.caption.long[#el.caption.long]
      if not last or #last.content == 0 then
        return nil
      end

      -- check for tbl label
      local label = el.identifier
      local caption, attr = parseTableCaption(last.content)
      if startsWith(attr.identifier, "tbl-") then
        -- set the label and remove it from the caption
        label = attr.identifier
        attr.identifier = ""
        caption = createTableCaption(caption, pandoc.Attr())
      end
      
      -- we've parsed the caption, so we can remove it from the table
      el.caption.long = pandoc.List({})

      if label == "" then
        return nil
      end

      local combined = merge_attrs(el.attr, attr)

      return quarto.FloatRefTarget({
        identifier = label,
        classes = combined.classes,
        attributes = as_plain_table(combined.attributes),
        type = "Table",
        content = pandoc.Blocks({ el }),
        caption_long = caption,
      }), false
    end,

    Div = function(div)
      if isFigureDiv(div, false) then
        -- The code below is a fixup that existed since the very beginning of
        -- quarto, see https://github.com/quarto-dev/quarto-cli/commit/12e770616869d43f5a1a3f84f9352491a2034bde
        -- and parent commits. We replicate it here to try and
        -- avoid a regression, in the absence of an associated regression test.
        --
        -- pandoc sometimes ends up with a fig prefixed title
        -- (no idea why right now!)
        div = _quarto.ast.walk(div, {
          Image = function(image)
            if image.title == "fig:" or image.title == "fig-" then
              image.title = ""
              return image
            end
          end
        })
        return parse_float_div(div)
      elseif isTableDiv(div) then
        return parse_float_div(div)
      elseif is_theorem_div(div) then
        return parse_theorem_div(div)
      end

      if div.classes:includes("cell") then
        process_div_caption_classes(div)
        -- forward cell attributes to potential FloatRefTargets
        div = _quarto.ast.walk(div, {
          Figure = function(fig)
            if div.attributes["cap-location"] then
              fig.attributes["cap-location"] = div.attributes["cap-location"]
            end
            for i, c in ipairs(div.classes) do
              local c = c:match(".*%-?cap%-location%-(.*)")
              if c then
                fig.attributes["cap-location"] = c
              end
            end
            return fig
          end,
          CodeBlock = function(block)
            for _, k in ipairs({"cap-location", "lst-cap-location"}) do
              if div.attributes[k] then
                block.attributes[k] = div.attributes[k]
              end
            end
            for i, c in ipairs(div.classes) do
              local c = c:match(".*%-?cap%-location%-(.*)")
              if c then
                block.attributes["cap-location"] = c
              end
            end
            return block
          end,
        })
        return div
      end
    end,

    Para = function(para)
      local img = discoverFigure(para, false)
      if img ~= nil then
        if img.identifier == "" and #img.caption == 0 then
          return nil
        end
        if img.identifier == "" then
          img.identifier = autoRefLabel("fig")
        end
        local identifier = img.identifier
        local type = refType(identifier)
        local category = crossref.categories.by_ref_type[type]
        if category == nil then
          warn("Figure with invalid crossref category: " .. identifier .. "\nWon't be able to cross-reference this figure.")
          return nil
        end
        return quarto.FloatRefTarget({
          identifier = identifier,
          classes = img.classes,
          attributes = as_plain_table(img.attributes),
          type = category.name,
          content = img,
          caption_long = img.caption,
        }), false
      end
      if discoverLinkedFigure(para) ~= nil then
        local link = para.content[1]
        local img = link.content[1]
        local identifier = img.identifier
        if img.identifier == "" then
          local caption = img.caption
          if #caption > 0 then
            img.caption = nil
            return pandoc.Figure(link, { long = { caption } })
          else
            return nil
            -- return pandoc.Figure(link)
          end
        end
        img.identifier = ""
        local type = refType(identifier)
        local category = crossref.categories.by_ref_type[type]
        if category == nil then
          fail("Figure with invalid crossref category? " .. identifier)
          return
        end
        local combined = merge_attrs(img.attr, link.attr)
        return quarto.FloatRefTarget({
          identifier = identifier,
          classes = combined.classes,
          attributes = as_plain_table(combined.attributes),
          type = category.name,
          content = link,
          caption_long = img.caption,
        }), false
      end
    end,

    DecoratedCodeBlock = function(decorated_code)
      local code = decorated_code.code_block
      local key_prefix = refType(code.identifier)
      if key_prefix ~= "lst" then
        return nil
      end
      local caption = code.attr.attributes['lst-cap']
      if caption == nil then
        return nil
      end
      code.attr.attributes['lst-cap'] = nil
      
      local attr = code.attr
      -- code.attr = pandoc.Attr("", {}, {})
      return quarto.FloatRefTarget({
        attr = attr,
        type = "Listing",
        content = { decorated_code.__quarto_custom_node }, -- this custom AST impedance mismatch here is unfortunate
        caption_long = caption,
      }), false
    end,

    CodeBlock = function(code)
      local key_prefix = refType(code.identifier)
      if key_prefix ~= "lst" then
        return nil
      end
      local caption = code.attr.attributes['lst-cap']
      if caption == nil then
        return nil
      end
      local caption_inlines = string_to_quarto_ast_blocks(caption)[1].content
      code.attr.attributes['lst-cap'] = nil
      local content = code
      if code.attr.attributes["filename"] then
        content = quarto.DecoratedCodeBlock({
          filename = code.attr.attributes["filename"],
          code_block = code:clone()
        })
      end
      
      local attr = code.attr
      code.attr = pandoc.Attr("", {}, {})
      return quarto.FloatRefTarget({
        attr = attr,
        type = "Listing",
        content = { content },
        caption_long = caption_inlines,
      }), false
    end,

    RawBlock = function(raw)
      if not (_quarto.format.isLatexOutput() and 
              _quarto.format.isRawLatex(raw)) then
        return nil
      end

      -- first we check if all of the expected bits are present

      -- check for {#...} or \label{...}
      if raw.text:find(patterns.latex_label) == nil and 
         raw.text:find(patterns.attr_identifier) == nil then
        return nil
      end

      -- check for \caption{...}
      if raw.text:find(patterns.latex_caption) == nil then
        return nil
      end

      -- check for tabular or longtable
      if raw.text:find(patterns.latex_long_table) == nil and
         raw.text:find(patterns.latex_tabular) == nil then
        return nil
      end
      
      -- if we're here, then we're going to parse this as a FloatRefTarget
      -- and we need to remove the label and caption from the raw block
      local identifier = ""
      local b, e, match1, label_identifier = raw.text:find(patterns.latex_label)
      if b ~= nil then
        raw.text = raw.text:sub(1, b - 1) .. raw.text:sub(e + 1)
        identifier = label_identifier
      else
        local b, e, match2, attr_identifier = raw.text:find(patterns.attr_identifier)
        if b ~= nil then
          raw.text = raw.text:sub(1, b - 1) .. raw.text:sub(e + 1)
          identifier = attr_identifier
        else
          internal_error()
          return nil
        end
      end

      -- knitr can emit a label that starts with "tab:"
      -- we don't handle those as floats
      local ref = refType(identifier)
      if ref == nil then
        return nil
      end

      local caption
      local b, e, match3, caption_content = raw.text:find(patterns.latex_caption)
      if b ~= nil then
        raw.text = raw.text:sub(1, b - 1) .. raw.text:sub(e + 1)
        caption = pandoc.RawBlock("latex", caption_content)
      else
        internal_error()
        return nil
      end

      -- finally, if the user passed a \\begin{table} float environment
      -- we just remove it because we'll re-emit later ourselves

      local b, e, begin_table, table_body, end_table = raw.text:find(patterns.latex_table)
      if b ~= nil then
        raw.text = table_body
      end

      return quarto.FloatRefTarget({
        attr = pandoc.Attr(identifier, {}, {}),
        type = "Table",
        content = { raw },
        caption_long = quarto.utils.as_blocks(caption)
      }), false
    end
    
  }
end

function forward_cell_subcaps()
  return {
    Div = function(div)
      if not div.classes:includes("cell") then
        return nil
      end
      local ref = refType(div.identifier)
      if ref == nil then
        return nil
      end
      local v = div.attributes[ref .. "-subcap"]
      if v == nil then
        return nil
      end
      local subcaps = quarto.json.decode(v)
      local index = 1
      div.content = _quarto.ast.walk(div.content, {
        Div = function(subdiv)
          if index > #subcaps or not subdiv.classes:includes("cell-output-display") then
            return nil
          end
          -- now we attempt to insert subcaptions where it makes sense for them to be inserted
          subdiv.content = _quarto.ast.walk(subdiv.content, {
            Table = function(pandoc_table)
              pandoc_table.caption.long = quarto.utils.as_blocks(pandoc.Str(subcaps[index]))
              pandoc_table.identifier = div.identifier .. "-" .. tostring(index)
              index = index + 1
              return pandoc_table
            end,
            Para = function(maybe_float)
              local fig = discoverFigure(maybe_float, false) or discoverLinkedFigure(maybe_float, false)
              if fig ~= nil then
                fig.caption = quarto.utils.as_inlines(pandoc.Str(subcaps[index]))
                fig.identifier = div.identifier .. "-" .. tostring(index)
                index = index + 1
                return maybe_float
              end
            end,
          })
          return subdiv
        end
      })
      if index ~= 1 then
        div.attributes[ref .. "-subcap"] = nil
      end
      return div
    end
  }
end