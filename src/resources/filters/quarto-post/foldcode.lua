-- foldcode.lua
-- Copyright (C) 2021 by RStudio, PBC

function foldCode()
  return {
    CodeBlock = function(block)
      if _quarto.format.isHtmlOutput() then
        if block.attr.classes:includes("cell-code") then
          local fold = foldAttribute(block)
          local summary = summaryAttribute(block)
          if fold ~= nil or summary ~= nil then
            block.attr.attributes["code-fold"] = nil
            block.attr.attributes["code-summary"] = nil
            if fold ~= "none" then 
              local blocks = pandoc.List()
              postState.codeFoldingCss = true
              local open = ""
              if fold == "show" then
                open = " open"
              end
              local beginPara = pandoc.Plain({
                pandoc.RawInline("html", "<details" .. open .. ">\n<summary>"),
              })
              tappend(beginPara.content, markdownToInlines(summary))
              beginPara.content:insert(pandoc.RawInline("html", "</summary>"))
              blocks:insert(beginPara)
              blocks:insert(block)
              blocks:insert(pandoc.RawBlock("html", "</details>"))
              return blocks
            else
              return block
            end
          end
        end
      end
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
  local fold = attribute(el, "code-fold", default)
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
  return attribute(el, "code-summary", default)
end


