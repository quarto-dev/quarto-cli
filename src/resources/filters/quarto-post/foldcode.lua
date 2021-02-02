-- foldcode.lua
-- Copyright (C) 2021 by RStudio, PBC

function foldCode()
  return {
    Blocks = function (blocks)
      if not isHtmlOutput() then
        return blocks
      end
      local filterBlocks = pandoc.List:new()
      for _,block in ipairs(blocks) do
        if block.t == "CodeBlock" and block.attr.classes:includes("cell-code") then
          local fold = foldAttribute(block)
          if fold then 
            local beginPara = pandoc.Para({
              pandoc.RawInline("html", "<details>\n<summary>"),
            })
            tappend(beginPara.content, markdownToInlines(fold))
            beginPara.content:insert(pandoc.RawInline("html", "</summary>"))
            filterBlocks:insert(beginPara)
            filterBlocks:insert(block)
            filterBlocks:insert(pandoc.RawBlock("html", "</details>"))
          else
            filterBlocks:insert(block)
          end
          block.attr.attributes["fold"] = nil
        else
          filterBlocks:insert(block)
        end
      end
      return filterBlocks
    end
  }
end

function foldAttribute(el)
  local default = param("fold-code")
  if default then
    default = pandoc.utils.stringify(default)
  end
  
  local fold = attribute(el, "fold", default)
  if fold then
    -- bail if false or 0
    if string.lower(fold) == "false" or fold == "0" then
      return nil
    end
    
    -- use default for 'true'
    if string.lower(fold) == "true" or fold == "1" then
      fold = "Show code"
    end
    
    -- return fold
    return fold
  end
end
