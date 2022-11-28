-- code.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


-- annotations appear at the end of the line and are of the form
-- # <1> 
-- where they start with a comment character valid for that code cell
-- and they contain a number which is the annotation number in the
-- OL that will appear after the annotation
-- 
-- TODO: Implement per language comment character
local kLineAnnotePattern = '.*# <([0-9]+)>%s*$'
local function annotationNumber(line)
  local _, _, annoteNumber = string.find(line, kLineAnnotePattern)
  if annoteNumber ~= nil then
    return tonumber(annoteNumber)
  else
    return nil
  end
end

-- Removes the annotation from the line
local function stripAnnotation(line, annoteId)
  return line:gsub('# <' .. annoteId .. '>%s*$', "")
end

-- Finds annotations in a code cell and returns 
-- the annotations as well as a code cell that
-- removes the annotations
--
-- TODO: Only use the stripped code cell when an OL is processed, otherwise we should 
-- just use the original code cell as is.
local function resolveCellAnnotes(codeBlockEl) 
  local annotations = {}
  local code = codeBlockEl.text
  local lines = split(code, "\n")
  local outputs = pandoc.List({})
  for i, line in ipairs(lines) do

    local annoteNumber = annotationNumber(line)
    if annoteNumber then
      -- Capture the annotation number and strip it
      local annoteId = 'annote-' .. tostring(annoteNumber)
      local lineNumbers = annotations[annoteId]
      if lineNumbers == nil then
        lineNumbers = pandoc.List({})
      end
      lineNumbers:insert(i)
      annotations[annoteId] = lineNumbers         

      local stripped = stripAnnotation(line, annoteId)
      outputs:insert(stripped)
    else
      outputs:insert(line)
    end
  end      

  local outputText = ""
  for i, output in ipairs(outputs) do
    outputText = outputText .. '\n' .. output
  end
  codeBlockEl.text = outputText
  return  codeBlockEl, annotations 
end

-- The actual filter that will look for a code cell and then
-- find its annotations, then process the subsequent OL
-- 
-- TODO: Deal with the pending annotations and update the OL text to include
-- line numbers (e.g. convert to a definition list, most likely)
-- TODO: Warn for unused annotations and warn for OL items without a correlated annotation
-- TODO: Need function to produce pretty line number text to use in DL
-- TODO: note that annote-id is key to pending annotations
function code() 
  return {
    traverse = 'topdown',
    Blocks = function(blocks) 
      local outputs = pandoc.List()

      -- annotations[annotation-number] = {list of line numbers}
      local pendingAnnotations = nil
      for i, block in ipairs(blocks) do
        if block.t == 'Div' and block.attr.classes:find('cell') then
          -- walk to find the code and 
          local resolvedBlock = pandoc.walk_block(block, {
            CodeBlock = function(el)
              if el.attr.classes:find('cell-code') then
                resolvedCodeBlock, annotations = resolveCellAnnotes(el)
                if #annotations then
                  pendingAnnotations = annotations
                end
                return resolvedCodeBlock
              end
            end
          })
          outputs:insert(resolvedBlock)
        elseif block.t == 'OrderedList' and pendingAnnotations ~= nil then
          outputs:insert(block)
        else
          pendingAnnotations = nil
          outputs:insert(block)
        end
      end
      return outputs
    end
  }
end