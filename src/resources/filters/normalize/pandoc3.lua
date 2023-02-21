-- pandoc3.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function parse_pandoc3_figures() 
  return {
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
          
          return pandoc.Para(image)
        else
          -- if user filters muck with images, we need to support this as well.
          -- however, we can't forward figure information along the image, so
          -- this is necessarily a best-effort situation until we truly fix figures.
          return pandoc.Para(fig.content[1].content)
        end
      else
        print("Couldn't parse figure:")
        print(fig)
        crash_with_stack_trace()
      end
    end
  }
end

function render_pandoc3_figures() 
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