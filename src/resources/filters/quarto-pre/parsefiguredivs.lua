-- parsefiguredivs.lua
-- Copyright (C) 2023 Posit Software, PBC

function parse_floats()

  local function parse_float_div(div)
    local key_prefix = refType(div.identifier)
    if key_prefix == nil then
      fail("Float div without crossref identifier?")
      return
    end
    local category = crossref.categories.by_prefix[key_prefix]
    if category == nil then
      fail("Float with invalid crossref category? " .. div.identifier)
      return
    end

    local content = div.content
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

    local caption = refCaptionFromDiv(div)
    if caption ~= nil then
      div.content:remove(#div.content)
    else
      caption = pandoc.Plain({})
    end
    return quarto.FloatCrossref({
      attr = attr,
      type = category.name,
      content = content,
      caption_long = {pandoc.Plain(caption.content)},
    })
  end

  return {

    Figure = function(fig)
      local identifier_parts = split(fig.identifier, "-")
      if identifier_parts == nil then
        fail("Figure without crossref identifier?")
        return
      end
      local key_prefix = identifier_parts[1]
      local category = crossref.categories.by_prefix[key_prefix]
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

      return quarto.FloatCrossref({
        attr = fig_attr,
        type = category.name,
        content = new_content.content,
        caption_long = fig.caption.long,
        caption_short = fig.caption.short,
      })
    end,

    -- if we see a table with a caption that includes a tbl- label, then
    -- we normalize that to a FloatCrossref
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

      return quarto.FloatCrossref({
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
        -- (no idea way right now!)
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
        local combined = merge_attrs(img.attr, link.attr)
        return quarto.FloatCrossref({
          identifier = identifier,
          classes = combined.classes,
          attributes = as_plain_table(combined.attributes),
          type = "Figure",
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
      return quarto.FloatCrossref({
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
      return quarto.FloatCrossref({
        attr = attr,
        type = "Listing",
        content = { content },
        caption_long = caption,
      })
    end
  }
end
