-- typst-code-annotations.lua
-- Copyright (C) 2026 Posit Software, PBC

-- Typst annotation helpers for code blocks.
-- Loaded via require() so locals stay out of the bundled main.lua scope.

local function _main()

  -- Convert annotations table to a flat Typst dictionary string.
  -- Keys are line positions (as strings), values are annotation numbers.
  local function typstAnnotationsDict(annotations)
    local entries = {}
    for annoteId, lineNumbers in pairs(annotations) do
      local num = annoteId:match("annote%-(%d+)")
      if num then
        for _, lineNo in ipairs(lineNumbers) do
          table.insert(entries, {pos = lineNo, annoteNum = tonumber(num)})
        end
      end
    end
    table.sort(entries, function(a, b) return a.pos < b.pos end)
    local parts = {}
    for _, e in ipairs(entries) do
      table.insert(parts, '"' .. tostring(e.pos) .. '": ' .. tostring(e.annoteNum))
    end
    return '(' .. table.concat(parts, ', ') .. ')'
  end

  -- Skylighting mode: emit a Typst comment that the TS post-processor
  -- will merge into the Skylighting call site.
  local function typstAnnotationMarker(annotations, cellId)
    local dict = typstAnnotationsDict(annotations)
    return pandoc.RawBlock("typst", "// quarto-code-annotations: " .. (cellId or "") .. " " .. dict)
  end

  -- Native/none mode: wrap a CodeBlock in #quarto-code-annotation(annotations)[...].
  -- raw.line numbers always start at 1 regardless of startFrom, so adjust keys.
  local function wrapTypstAnnotatedCode(codeBlock, annotations, cellId)
    local startFrom = tonumber(codeBlock.attr.attributes['startFrom']) or 1
    local adjustedAnnotations = {}
    for annoteId, lineNumbers in pairs(annotations) do
      local adjusted = pandoc.List({})
      for _, lineNo in ipairs(lineNumbers) do
        adjusted:insert(lineNo - startFrom + 1)
      end
      adjustedAnnotations[annoteId] = adjusted
    end
    local dict = typstAnnotationsDict(adjustedAnnotations)
    local lang = codeBlock.attr.classes[1] or ""
    local code = codeBlock.text
    local maxBackticks = 2
    for seq in code:gmatch("`+") do
      maxBackticks = math.max(maxBackticks, #seq)
    end
    local fence = string.rep("`", maxBackticks + 1)
    local raw = "#quarto-code-annotation(" .. dict
      .. (cellId and cellId ~= "" and (", cell-id: \"" .. cellId .. "\"") or "")
      .. ")[" .. fence .. lang .. "\n" .. code .. "\n" .. fence .. "]"
    return pandoc.RawBlock("typst", raw)
  end

  return {
    typstAnnotationsDict = typstAnnotationsDict,
    typstAnnotationMarker = typstAnnotationMarker,
    wrapTypstAnnotatedCode = wrapTypstAnnotatedCode,
  }
end

return _main()
