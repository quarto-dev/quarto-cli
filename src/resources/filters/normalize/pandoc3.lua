-- pandoc3.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function parse_pandoc3_figures()
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

      return quarto.FloatCrossref({
        identifier = fig.identifier,
        classes = fig.classes,
        attributes = fig.attributes,
        type = category.name,
        content = fig.content,
        caption_long = fig.caption.long,
        caption_short = fig.caption.short,
      })
    end
  }
  -- local walk_recurse
  -- walk_recurse = function(constructor)
  --   local plain_figure_treatment = function(el)
  --     return _quarto.ast.walk(el, walk_recurse(pandoc.Plain))
  --   end
  --   local para_figure_treatment = function(el)
  --     return _quarto.ast.walk(el, walk_recurse(pandoc.Para))
  --   end
  --   return {
  --     traverse = "topdown",
  --     BulletList = para_figure_treatment,
  --     BlockQuote = plain_figure_treatment,
  --     Table = plain_figure_treatment,
  --     Div = para_figure_treatment,
  --     OrderedList = plain_figure_treatment,
  --     Note = plain_figure_treatment,
  --     Figure = function(fig)
  --       if (#fig.content == 1 and fig.content[1].t == "Plain") then
  --         local forwarded_id = false
  --         return constructor(_quarto.ast.walk(fig.content[1].content, {
  --           Image = function(image)
  --             image.classes:extend(fig.classes)
  --             for k, v in pairs(fig.attributes) do
  --               image.attributes[k] = v
  --             end
  --             flags.has_figure_divs = true
  --             if fig.identifier ~= "" then
  --               if not forwarded_id then
  --                 image.identifier = fig.identifier
  --                 forwarded_id = true
  --               end
  --             end
  --             return image
  --           end
  --         }))
  --       else
  --         error("Couldn't parse figure:")
  --         fatal(fig)
  --       end
  --     end
  --   }
  -- end
  -- return {
  --   Pandoc = function(doc)
  --     local result = _quarto.ast.walk(doc, walk_recurse(pandoc.Para))
  --     return result
  --   end
  -- }
end

function render_pandoc3_figures() 
  -- only do this in jats and typst because other formats emit <figure> inadvertently otherwise
  -- with potentially bad captions.
  -- 
  -- this will change with new crossref system anyway.
  if not _quarto.format.isJatsOutput() and not _quarto.format.isTypstOutput() then
    return {}
  end
  
  return {
    Para = function(para)
      if (#para.content == 1 and para.content[1].t == "Image" and
          hasFigureRef(para.content[1])) then
        
        -- the image
        local img = para.content[1]
        
        -- clear the id (otherwise the id will be present on both the image)
        -- and the figure
        local figAttr = img.attr:clone()
        img.attr.identifier = ""
        
        local caption = img.caption
        return pandoc.Figure(
          pandoc.Plain(para.content[1]),
          {
            short = nil,
            long = {pandoc.Plain(caption)}
          },
          figAttr)
      end
    end,
  }
end