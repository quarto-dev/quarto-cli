-- pandoc3.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function parse_pandoc3_figures() 
  local walk_recurse
  walk_recurse = function(constructor)
    local drop_figure_treatment = function(el)
      return el:walk(walk_recurse(pandoc.Plain))
    end
    return {
      traverse = "topdown",
      BulletList = drop_figure_treatment,
      BlockQuote = drop_figure_treatment,
      Table = drop_figure_treatment,
      OrderedList = drop_figure_treatment,
      Note = drop_figure_treatment,
      Figure = function(fig)
        if (#fig.content == 1 and fig.content[1].t == "Plain") then
          
          if #fig.content[1].content == 1 and fig.content[1].content[1].t == "Image" then
            -- "pandoc 2 normalization"
            local image = fig.content[1].content[1]
            image.classes:extend(fig.classes)
            for k, v in pairs(fig.attributes) do
              image.attributes[k] = v
            end
            if fig.identifier ~= "" then
              image.identifier = fig.identifier
            end
            
            return constructor(image)
          else
            -- if user filters muck with images, we need to support this as well.
            -- however, we can't forward figure information along the image, so
            -- this is necessarily a best-effort situation until we truly fix figures.
            return constructor(fig.content[1].content)
          end
        else
          error("Couldn't parse figure:")
          error(fig)
          crash_with_stack_trace()
        end
      end
    }
  end

  return {
    Pandoc = function(doc)
      local result = doc:walk(walk_recurse(pandoc.Para))
      return result
    end
  }
end

function render_pandoc3_figures() 
  -- only do this in jats because other formats emit <figure> inadvertently otherwise
  -- with potentially bad captions.
  -- 
  -- this will change with new crossref system anyway.
  if not _quarto.format.isJatsOutput() then
    return {}
  end
  
  return {
    Para = function(para)
      if (#para.content == 1 and para.content[1].t == "Image" and
          hasFigureRef(para.content[1])) then
        local img = para.content[1]
        -- quarto.utils.dump(img.caption)
        local caption = img.caption
        return pandoc.Figure(
          pandoc.Plain(para.content[1]),
          {
            short = nil,
            long = {pandoc.Plain(caption)}
          },
          img.attr)
      end
    end,
  }
end