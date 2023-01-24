-- pandoc3.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function parse_pandoc3_figures() 
  return {
    Figure = function(fig)
      if (#fig.content == 1 and fig.content[1].t == "Plain" and 
          #fig.content[1].content == 1 and fig.content[1].content[1].t == "Image") then
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
        print("Couldn't parse figure:")
        print(fig)
        crash_with_stack_trace()
      end
    end
  }
end