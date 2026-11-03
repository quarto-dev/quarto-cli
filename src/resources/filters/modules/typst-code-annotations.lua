-- typst-code-annotations.lua
-- Copyright (C) 2026 Posit Software, PBC

-- Typst annotation helpers for code blocks.
-- Loaded via require() so locals stay out of the bundled main.lua scope.

local function _main()

  local function typstEscapeString(s)
    return (s:gsub('[\\"]', "\\%0"))
  end

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

  -- Annotation line numbers are collected display-based (shifted by the
  -- startFrom attribute or the fenced-echo start line). Typst-side rendering
  -- always counts source lines from 1, so shift keys back with the same
  -- offset used at collection time.
  local function adjustAnnotations(annotations, offset)
    offset = offset or 1
    local adjusted = {}
    for annoteId, lineNumbers in pairs(annotations) do
      local list = pandoc.List({})
      for _, lineNo in ipairs(lineNumbers) do
        list:insert(lineNo - offset + 1)
      end
      adjusted[annoteId] = list
    end
    return adjusted
  end

  -- Skylighting mode: emit a Typst comment that the TS post-processor
  -- will merge into the Skylighting call site.
  local function typstAnnotationMarker(annotations, cellId, offset)
    local dict = typstAnnotationsDict(adjustAnnotations(annotations, offset))
    return pandoc.RawBlock("typst", "// quarto-code-annotations: " .. typstEscapeString(cellId or "") .. " " .. dict)
  end

  -- Native/none mode: wrap a CodeBlock in #quarto-code-annotation(annotations)[...].
  -- raw.line numbers always start at 1 regardless of startFrom, so adjust keys.
  local function wrapTypstAnnotatedCode(codeBlock, annotations, cellId, offset, dropLanguage)
    local lang = not dropLanguage and codeBlock.attr.classes[1] or ""
    local code = codeBlock.text
    -- engine_escape runs after this filter and would rewrite an escaped
    -- engine block into a markdown block that shows the fence line, so
    -- do the same here and shift the keys past the added fence line.
    local engine = codeBlock.attr.classes[1]
      and codeBlock.attr.classes[1]:match(_quarto.modules.patterns.engine_escape)
    if engine then
      code = "```" .. engine .. "\n" .. code .. "\n```"
      lang = dropLanguage and "" or "markdown"
      offset = (offset or 1) - 1
    end
    local dict = typstAnnotationsDict(adjustAnnotations(annotations, offset))
    local maxBackticks = 2
    for seq in code:gmatch("`+") do
      maxBackticks = math.max(maxBackticks, #seq)
    end
    local fence = string.rep("`", maxBackticks + 1)
    local raw = "#quarto-code-annotation(" .. dict
      .. (cellId and cellId ~= "" and (", cell-id: \"" .. typstEscapeString(cellId) .. "\"") or "")
      .. ")[" .. fence .. lang .. "\n" .. code .. "\n" .. fence .. "]"
    return pandoc.RawBlock("typst", raw)
  end

  return {
    typstEscapeString = typstEscapeString,
    typstAnnotationsDict = typstAnnotationsDict,
    typstAnnotationMarker = typstAnnotationMarker,
    wrapTypstAnnotatedCode = wrapTypstAnnotatedCode,
  }
end

return _main()
