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
          if fold ~= "none" then 
            postState.codeFoldingCss = true
            local open = ""
            if fold == "show" then
              open = " open"
            end
            local beginPara = pandoc.Para({
              pandoc.RawInline("html", "<details" .. open .. ">\n<summary>"),
            })
            tappend(beginPara.content, markdownToInlines(summaryAttribute(block)))
            beginPara.content:insert(pandoc.RawInline("html", "</summary>"))
            filterBlocks:insert(beginPara)
            filterBlocks:insert(block)
            filterBlocks:insert(pandoc.RawBlock("html", "</details>"))
          else
            filterBlocks:insert(block)
          end
          block.attr.attributes["fold"] = nil
          block.attr.attributes["summary"] = nil
        else
          filterBlocks:insert(block)
        end
      end
      return filterBlocks
    end
  }
end

function foldAttribute(el)
  local default = param("code-fold")
  if default then
    default = pandoc.utils.stringify(default)
  else
    default = "none"
  end
  local fold = attribute(el, "fold", default)
  if fold == true or fold == "true" or fold == "1" then
    return "hide"
  elseif fold == nil or fold == false or fold == "false" or fold == "0" then
    return "none"
  else
    return tostring(fold)
  end
end

function summaryAttribute(el)
  local default = param("code-summary")
  if default then
    default = pandoc.utils.stringify(default)
  else
    default = "Code"
  end
  return attribute(el, "summary", default)
end


