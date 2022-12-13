-- code.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


-- for a given language, the comment character(s)
local kLangCommentChars = {
  r = {"#"},
  python = {"#"},
  julia = {"#"},
  scala = {"//"},
  matlab = {"%"},
  csharp = {"//"},
  fsharp = {"//"},
  c = {"/*", "*/"},
  css = {"/*", "*/"},
  sas = {"*", ";"},
  powershell = {"#"},
  bash = {"#"},
  sql = {"--"},
  mysql = {"--"},
  psql = {"--"},
  lua = {"--"},
  cpp = {"//"},
  cc = {"//"},
  stan = {"#"},
  octave = {"#"},
  fortran = {"!"},
  fortran95 = {"!"},
  awk = {"#"},
  gawk = {"#"},
  stata = {"*"},
  java = {"//"},
  groovy = {"//"},
  sed = {"#"},
  perl = {"#"},
  ruby = {"#"},
  tikz = {"%"},
  js = {"//"},
  d3 = {"//"},
  node = {"//"},
  sass = {"//"},
  coffee = {"#"},
  go = {"//"},
  asy = {"//"},
  haskell = {"--"},
  dot = {"//"},
  mermaid = {"%%"},
  apl = {"⍝"}
}

local kDataCodeCellTarget = 'data-code-cell'
local kDataCodeCellLines = 'data-code-lines'

-- annotations appear at the end of the line and are of the form
-- # <1> 
-- where they start with a comment character valid for that code cell
-- and they contain a number which is the annotation number in the
-- OL that will appear after the annotation


-- This provider will yield functions for a particular language that 
-- can be used to resolve annotation numbers and strip them from source 
-- code
local function annoteProvider(lang) 
  local commentChars = kLangCommentChars[lang]
  if commentChars ~= nil then
    local expressions = pandoc.List({})
    for _i, v in ipairs(commentChars) do
      expressions:insert({
        match = '.*' .. v .. ' <([0-9]+)>%s*$',
        strip = {
          prefix = '%s*' .. v .. ' <',
          suffix = '>%s*$'
        },
      })
    end

    return {
      annotationNumber = function(line) 
        for _i, v in ipairs(expressions) do
          local _, _, annoteNumber = string.find(line, v.match)
          if annoteNumber ~= nil then
            return tonumber(annoteNumber)
          end
        end
        return nil
      end,
      stripAnnotation = function(line, annoteId) 
        for _i, v in ipairs(expressions) do
          line = line:gsub(v.strip.prefix .. annoteId .. v.strip.suffix, "")
        end
        return line
      end,
    }
  else
    return nil
  end
end


local function toAnnoteId(number) 
  return 'annote-' .. tostring(number)
end

-- Finds annotations in a code cell and returns 
-- the annotations as well as a code cell that
-- removes the annotations
local function resolveCellAnnotes(codeBlockEl) 
  -- collect any annotations on this code cell
  local lang = codeBlockEl.attr.classes[1]  
  local annotationProvider = annoteProvider(lang)
  if annotationProvider ~= nil then
    local annotations = {}
    local code = codeBlockEl.text
    local lines = split(code, "\n")
    local outputs = pandoc.List({})
    for i, line in ipairs(lines) do
  
      -- Look and annotation
      local annoteNumber = annotationProvider.annotationNumber(line)
      if annoteNumber then
        -- Capture the annotation number and strip it
        local annoteId = toAnnoteId(annoteNumber)
        local lineNumbers = annotations[annoteId]
        if lineNumbers == nil then
          lineNumbers = pandoc.List({})
        end
        lineNumbers:insert(i)
        annotations[annoteId] = lineNumbers         
  
        local stripped = annotationProvider.stripAnnotation(line, annoteNumber)
        outputs:insert(stripped)
      else
        outputs:insert(line)
      end
    end      

    -- if we capture annotations, then replace the code source
    -- code, stripping annotation comments
    if #annotations then
      local outputText = ""
      for i, output in ipairs(outputs) do
        outputText = outputText .. '\n' .. output
      end
      codeBlockEl.attr.classes:insert('numberLines')
      codeBlockEl.text = outputText
    end
    return codeBlockEl, annotations 
  elseif lang then
    warn("Unknown language " .. lang .. " when attempting to read code annotations. Any annotations will be ignored.")
    return codeBlockEl, {}
  end
  
end

local function lineNumberStr(list) 

  -- accumulates the output string
  local val = ''
  local addLines = function(lines) 
    if val == '' then
      val = lines
    else 
      val = val .. ',' .. lines
    end
  end

  -- writes out either an individual number of a range
  -- of numbers (from pending to current)
  local pending = nil
  local current = nil
  local valuesWritten = 0;
  local writePending = function()
    if pending == current then
      addLines(tostring(current))
      pending = nil
      current = nil
      valuesWritten = valuesWritten + 1 -- one for the pending line number
    else
      addLines(tostring(pending) .. '-' .. tostring(current))
      pending = nil
      current = nil
      valuesWritten = valuesWritten + 2 -- one for pending, one for current
    end
  end

  -- go through the line numbers and collapse sequences of numbers
  -- into a line number ranges when possible
  local lineNoStr = ""
  for _i, v in ipairs(list) do
    if lineNoStr == "" then
      lineNoStr = v
    else 
      lineNoStr = lineNoStr .. ',' .. v
    end

    if pending == nil then
      pending = v
      current = v
    else
      if v == current + 1 then
        current = v
      else 
        writePending()
        pending = v
        current = v
      end
    end
  end
  if pending ~= nil then
    writePending()
  end

  return {
    text = val,
    count = valuesWritten,
    lineNumbers = lineNoStr
  }
end

-- The actual filter that will look for a code cell and then
-- find its annotations, then process the subsequent OL
function code() 
  return {
    traverse = 'topdown',
    Blocks = function(blocks) 
      local outputs = pandoc.List()

      -- annotations[annotation-number] = {list of line numbers}
      local pendingAnnotations = nil
      local pendingCellId = nil
      local idCounter = 1

      local clearPending = function() 
        pendingAnnotations = nil
        pendingCellId = nil
      end

      local processCodeCell = function(el, identifier)
        local resolvedCodeBlock, annotations = resolveCellAnnotes(el)
        if annotations and #annotations then
          pendingAnnotations = annotations
          pendingCellId = identifier
          return resolvedCodeBlock
        else
          return nil
        end
      end

      for i, block in ipairs(blocks) do
        if block.t == 'Div' and block.attr.classes:find('cell') then
          -- walk to find the code and 
          local resolvedBlock = pandoc.walk_block(block, {
            CodeBlock = function(el)
              if el.attr.classes:find('cell-code') then
                return processCodeCell(el, block.attr.identifier)
              end
            end
          })
          outputs:insert(resolvedBlock)
        elseif block.t == 'CodeBlock'  then
          if not block.attr.classes:find('cell-code') then
            local cellId = block.attr.identifier
            if cellId == '' then
              cellId = 'annotated-cell-' .. tostring(idCounter)
              idCounter = idCounter + 1
            end
  
            local codeCell = processCodeCell(block, cellId)
            if codeCell then
              -- codeCell.attr.identifier = cellId;
              outputs:insert(codeCell)
            else
              outputs:insert(block)
              clearPending()
            end
          else
            outputs:insert(block)
            clearPending()
          end
        elseif block.t == 'OrderedList' and pendingAnnotations ~= nil and next(pendingAnnotations) ~= nil then
          -- There are pending annotations, which means this OL is immediately after
          -- a code cell with annotations. Use to emit a DL describing the code

          local items = pandoc.List()
          for i, v in ipairs(block.content) do
            -- get the line numbers
            local annoteId = toAnnoteId(i)
            local annotation = pendingAnnotations[annoteId]
            if annotation then
              local lineNumberTbl = lineNumberStr(annotation)

              -- TODO: Localize
              local label = ""
              if lineNumberTbl.count == 1 then
                label = "Line " .. lineNumberTbl.text;
              else
                label = "Lines " .. lineNumberTbl.text;
              end

              local cellReference = pandoc.Span(label, {
                [kDataCodeCellTarget] = pendingCellId,
                [kDataCodeCellLines] = lineNumberTbl.lineNumbers
              });

              -- find the lines that annotate this and convert to a DL
              items:insert({
                cellReference,
                v})
            else
              -- there was an OL item without a corresponding annotation
              warn("List item " .. tostring(i) .. " has no corresponding annotation in the code cell\n(" .. pandoc.utils.stringify(v) ..  ")")
            end
          end

          -- add the definition list
          local dl = pandoc.DefinitionList(items)
          outputs:insert(dl)

          -- annotations were processed
          clearPending()
        else
          outputs:insert(block)
          clearPending()
        end
      end
      return outputs
    end
  }
end