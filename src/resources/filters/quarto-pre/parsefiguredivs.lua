-- parsefiguredivs.lua
-- Copyright (C) 2023 Posit Software, PBC

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
      if content == nil then
        internal_error()
        return nil
      end
      
      -- TODO are there other cases where we should look for captions?
      if not found_caption then
        caption = pandoc.Plain({})
      end
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
    return quarto.FloatRefTarget({
      attr = attr,
      type = category.name,
      content = content,
      caption_long = {pandoc.Plain(caption.content)},
    })
  end

  return {

    Figure = function(fig)
      local key_prefix = refType(fig.identifier)
      if key_prefix == nil then
        -- Figure without crossref identifier, must attempt to guess content
        local is_image
        _quarto.ast.walk(fig.content, {
          Image = function(image)
            if image.caption ~= nil then
              is_image = true
            end
          end
        })
        if is_image then
          fig.identifier = autoRefLabel("fig")
          key_prefix = refType(fig.identifier)
        else
          warn("Quarto could not guess the crossref type for the following figure:")
          warn(tostring(fig))
          warn("Quarto will simply use the figure content. Please add an explicit label to the figure")
          return fig.content
        end
      end
      local category = crossref.categories.by_ref_type[key_prefix]
      if category == nil then
        fail("Figure with invalid crossref category? " .. fig.identifier)
        return
      end

      if #fig.content ~= 1 and fig.content[1].t ~= "Plain" then
        print(fig)
        fail("Don't know how to parse this pandoc 3 figure")
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
      })
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
      local label = nil
      local caption, attr = parseTableCaption(last.content)
      if startsWith(attr.identifier, "tbl-") then
        -- set the label and remove it from the caption
        label = attr.identifier
        attr.identifier = ""
        el.caption.long = pandoc.List({})
        caption = createTableCaption(caption, attr)
      end
    
      if not label then
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
      })
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
        })
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
      })
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
      })
    end
  }
end
