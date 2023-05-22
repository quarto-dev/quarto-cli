-- foldcode.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function foldCode()
  return {
    CodeBlock = function(block)
      if _quarto.format.isHtmlOutput() or _quarto.format.isMarkdownWithHtmlOutput() then
        if block.attr.classes:includes("cell-code") then
          local fold = foldAttribute(block)
          local summary = summaryAttribute(block)
          if fold ~= nil or summary ~= nil then
            block.attr.attributes["code-fold"] = nil
            block.attr.attributes["code-summary"] = nil
            if fold ~= "none" then 
              local blocks = pandoc.List()
              quarto_global_state.codeFoldingCss =  _quarto.format.isHtmlOutput()
              local open = ""
              if fold == "show" then
                open = " open"
              end
              local style = ""
              if block.attr.classes:includes("hidden") then
                style = ' class="hidden"'
              end
              local beginPara = pandoc.Plain({
                pandoc.RawInline("html", "<details" .. open .. style .. ">\n<summary>"),
              })
              
              if not isEmpty(summary) then
                tappend(beginPara.content, markdownToInlines(summary))
              end
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

function isEmpty(str) 
  return str == nil or string.len(trim(str)) == 0
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


