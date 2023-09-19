-- parsefiguredivs.lua
-- Copyright (C) 2023 Posit Software, PBC

local patterns = require("modules/patterns")

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

function parse_floats()

  local function parse_float_div(div)
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

    local content = div.content
    local caption_attr_key = ref .. "-cap"

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
    if (#content >= 1 and #content <= 2 and content[1].t == "Para" and
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

    -- respect single table in latex longtable fixups above
    if skip_outer_reftarget then
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
      for i, element in ipairs(content or {}) do
        if element.t == "Div" and element.classes:includes("cell-output-display") then
          found_cell_output_display = true
        end
        if found_cell_output_display then
          final_content.content:insert(element)
        else
          return_cell.content:insert(element)
        end
      end

      return_cell.classes = div.classes
      return_cell.attributes = div.attributes
      local reftarget = quarto.FloatRefTarget({
        attr = attr,
        type = category.name,
        content = final_content,
        caption_long = {pandoc.Plain(caption.content)},
      })
      -- need to reference as a local variable because of the
      -- second return value from the constructor
      return_cell.content:insert(reftarget)
      return return_cell
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
        el.caption.long = pandoc.List({})
        caption = createTableCaption(caption, attr)
      end

      if label == "" then
        return nil
      end

      local combined = merge_attrs(el.attr, attr)

      return quarto.FloatRefTarget({
        identifier = label,
        classes = combined.classes,
        attributes = as_plain_table(combined.attributes),
        type = "Table",
        content = { el },
        caption_long = caption,
      }), false
    end,

    Div = function(div)
      if isFigureDiv(div) then
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
      end
    end,

    Para = function(para)
      local img = discoverFigure(para, false)
      if img ~= nil then
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
          return nil
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
    end
  }
end
