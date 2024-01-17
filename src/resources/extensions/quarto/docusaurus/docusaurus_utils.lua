-- docusaurus_utils.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- a slightly different version of render_folded_block
-- that avoids emitting rawhtml blocks, since these are handled
-- specially by the docusaurus filter
function render_folded_block(block)
  local make_code_fold_html = function(fold, summary)
    local div = pandoc.Div({}, pandoc.Attr("", { 
      "quarto-scaffold" 
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
      pandoc.RawInline("markdown", "<details" .. open .. style .. ">\n<summary>"),
    })
    
    if not isEmpty(summary) then
      tappend(beginPara.content, markdownToInlines(summary))
    end
    beginPara.content:insert(pandoc.RawInline("markdown", "</summary>"))
    div.content:insert(beginPara)
    div.content:insert(block)
    div.content:insert(pandoc.RawInline("markdown", "</details>"))
    return div
  end
  local make_code_cell_scaffold = function(div)
    return pandoc.Div({ block }, pandoc.Attr("", { "quarto-scaffold" }))
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
      return block
    end
  else
    return block
  end
end

function code_block(code_block_slot, filename)
  function process(el)
    local lang = el.attr.classes[1]
    local title = filename or el.attr.attributes["filename"] or el.attr.attributes["title"]
    local showLineNumbers = el.attr.classes:includes('number-lines')
    local codeLineNumbers = el.attr.attributes["code-line-numbers"]
    if lang or title or showLineNumbers then
      if not lang then
        lang = 'text'
      end
      local code = "\n```" .. lang
      if codeLineNumbers then
        code = code .. " {" .. codeLineNumbers .. "}"
      end
      if showLineNumbers then
        code = code .. " showLineNumbers"
      end
      if title then
        code = code .. " title=\"" .. title .. "\""
      end
      code = code .. "\n" .. el.text .. "\n```\n"
  
      -- docusaures code block attributes don't conform to any syntax
      -- that pandoc natively understands, so return the CodeBlock as
      -- "raw" markdown (so it bypasses pandoc processing entirely)
      return pandoc.RawBlock("markdown", code)
  
    elseif #el.attr.classes == 0 then
      el.attr.classes:insert('text')
      return el
    else
      return el
    end
  end

  code_block_slot = render_folded_block(code_block_slot) or code_block_slot
  
  if code_block_slot.t == "CodeBlock" then
    return process(code_block_slot)
  else
    return _quarto.ast.walk(code_block_slot, {
      CodeBlock = process
    })
  end
end

return {
  code_block = code_block
}