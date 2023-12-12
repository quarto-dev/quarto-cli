-- foldcode.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

-- slightly fancy code here to make two operations work in a single pass

local pass_uuid = "8c6b3915-b784-4ce5-8e73-59b368a9f289"

function render_folded_block(block)
  local make_code_fold_html = function(fold, summary)
    local div = pandoc.Div({}, pandoc.Attr("", { 
      "quarto-scaffold", pass_uuid 
    }))
    quarto_global_state.codeFoldingCss = _quarto.format.isHtmlOutput()
    local open = ""
    if fold == "show" then
      open = " open"
    end
    local style = ""
    local clz = 'code-fold'
    if block.attr.classes:includes("hidden") then
      clz = clz .. " hidden"
    end

    style = ' class="' .. clz .. '"'
    local beginPara = pandoc.Plain({
      pandoc.RawInline("html", "<details" .. open .. style .. ">\n<summary>"),
    })
    
    if not isEmpty(summary) then
      tappend(beginPara.content, markdownToInlines(summary))
    end
    beginPara.content:insert(pandoc.RawInline("html", "</summary>"))
    div.content:insert(beginPara)
    div.content:insert(block)
    div.content:insert(pandoc.RawBlock("html", "</details>"))
    return div
  end
  local make_code_cell_scaffold = function(div)
    return pandoc.Div({ block }, pandoc.Attr("", { "quarto-scaffold", pass_uuid }))
  end
  if not block.attr.classes:includes("cell-code") then
    return nil
  end
  if not (_quarto.format.isHtmlOutput() or _quarto.format.isMarkdownWithHtmlOutput()) then
    return make_code_cell_scaffold(block)
  end
  local fold = foldAttribute(block)
  local summary = summaryAttribute(block)
  if fold ~= nil or summary ~= nil then
    block.attr.attributes["code-fold"] = nil
    block.attr.attributes["code-summary"] = nil
    if fold ~= "none" then 
      return make_code_fold_html(fold, summary)
    else
      return make_code_cell_scaffold(block)
    end
  else
    return make_code_cell_scaffold(block)
  end
end

function fold_code_and_lift_codeblocks()
  return {
    traverse = "topdown",
    FloatRefTarget = function(float, float_node)
      -- we need some special case logic to not lift code blocks
      -- from listing floats that have no other content.
      local other_content_found = false
      _quarto.ast.walk(float.content, {
        Div = function(div)
          if not div.classes:includes(pass_uuid) then
            other_content_found = true
          end
        end,
      })
      if not other_content_found then
        return nil
      end

      local blocks = pandoc.Blocks({})
      -- ok to lift codeblocks
      float.content = _quarto.ast.walk(float.content, {
        Div = function(div)
          if div.classes:includes(pass_uuid) then
            blocks:insert(div)
            return {}
          end
        end
      })
      if #blocks > 0 then
        blocks:insert(float_node)
        return blocks
      end
    end,

    DecoratedCodeBlock = function(block)
      -- defer the folding of code blocks to the DecoratedCodeBlock renderer
      -- so that we can handle filename better
      return nil, false
    end,

    CodeBlock = render_folded_block
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


