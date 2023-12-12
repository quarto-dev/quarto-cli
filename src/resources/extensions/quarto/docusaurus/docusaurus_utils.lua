-- docusaurus_utils.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

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