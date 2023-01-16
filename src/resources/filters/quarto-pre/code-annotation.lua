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
  apl = {"⍝"},
  yaml = {"#"},
  json = {"//"},
  latex = {"%"},
  typescript = {"//"}
}

local kCodeAnnotationsParam = 'code-annotations'
local kDataCodeCellTarget = 'data-code-cell'
local kDataCodeCellLines = 'data-code-lines'
local kDataCodeCellAnnotation = 'data-code-annotation'
local kDataCodeAnnonationClz = 'code-annotation-code'

local kCodeAnnotationStyleNone = "none"

local kCodeLine = "code-line"
local kCodeLines = "code-lines"

local hasAnnotations = false;

local kCellAnnotationClass = "cell-annotation"

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

    local startComment = patternEscape(commentChars[1])
    local matchExpr = '.*' .. startComment .. '%s*<([0-9]+)>%s*'
    local stripPrefix = '%s*' .. startComment .. '%s*<'
    local stripSuffix = '>%s*'
    if #commentChars == 2 then
      local endComment = patternEscape(commentChars[2])
      matchExpr = matchExpr .. endComment .. '%s*'
      stripSuffix = stripSuffix .. endComment .. '%s*'
    end
    matchExpr = matchExpr .. '$'
    stripSuffix = stripSuffix .. '$'

    local expression = {
        match = matchExpr,
        strip = {
          prefix = stripPrefix,
          suffix = stripSuffix
        },
      }

    return {
      annotationNumber = function(line) 
          local _, _, annoteNumber = string.find(line, expression.match)
          if annoteNumber ~= nil then
            return tonumber(annoteNumber)
          else
            return nil
          end
      end,
      stripAnnotation = function(line, annoteId) 
        return line:gsub(expression.strip.prefix .. annoteId .. expression.strip.suffix, "")
      end,
      replaceAnnotation = function(line, annoteId, replacement)
        return line:gsub(expression.strip.prefix .. annoteId .. expression.strip.suffix, replacement)
      end,
      createComment = function(value) 
        if #commentChars == 0 then
          return value
        else if #commentChars == 1 then
          return commentChars[1] .. ' ' .. value
        else
          return commentChars[1] .. ' '.. value .. ' ' .. commentChars[2]
        end
      end

      end
    }
  else
    return nil
  end
end


local function toAnnoteId(number) 
  return 'annote-' .. tostring(number)
end

local function latexListPlaceholder(number)
  return '5CB6E08D-list-annote-' .. number 
end

-- Finds annotations in a code cell and returns 
-- the annotations as well as a code cell that
-- removes the annotations
local function resolveCellAnnotes(codeBlockEl, processAnnotation) 

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
        outputs:insert(processAnnotation(line, annoteNumber, annotationProvider))
      else
        outputs:insert(line)
      end
    end    

    -- if we capture annotations, then replace the code source
    -- code, stripping annotation comments
    if #annotations then
      local outputText = ""
      for i, output in ipairs(outputs) do
        outputText = outputText .. output .. '\n'
      end
      codeBlockEl.text = outputText
      hasAnnotations = true
    end
    return codeBlockEl, annotations 
  elseif lang then
    return codeBlockEl, {}
  end
  
end

local function lineNumberMeta(list) 

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

function processLaTeXAnnotation(line, annoteNumber, annotationProvider)
  -- we specially handle LaTeX output in coordination with the post processor
  -- which will replace any of these tokens as appropriate.   
  local hasHighlighting = param('text-highlighting', false)
  if param(kCodeAnnotationsParam) == kCodeAnnotationStyleNone then
    local replaced = annotationProvider.replaceAnnotation(line, annoteNumber, '') 
    return replaced
  else
    if hasHighlighting then
      -- highlighting is enabled, allow the comment through
      local placeholderComment = annotationProvider.createComment("<" .. tostring(annoteNumber) .. ">")
      local replaced = annotationProvider.replaceAnnotation(line, annoteNumber, placeholderComment) 
      return replaced
    else
      -- no highlighting enabled, ensure we use a standard comment character
      local placeholderComment = "%% (" .. tostring(annoteNumber) .. ")"
      local replaced = annotationProvider.replaceAnnotation(line, annoteNumber, placeholderComment) 
      return replaced
    end
  end
end

function processAnnotation(line, annoteNumber, annotationProvider)
    -- For all other formats, just strip the annotation- the definition list is converted
    -- to be based upon line numbers. 
    local stripped = annotationProvider.stripAnnotation(line, annoteNumber)
    return stripped
end

function codeMeta()
  return {
    Meta = function(meta)
      if _quarto.format.isLatexOutput() and hasAnnotations then
        -- ensure we have tikx for making the circles
        quarto.doc.use_latex_package("tikz");
        quarto.doc.include_text('in-header', [[
        \newcommand*\circled[1]{\tikz[baseline=(char.base)]{
          \node[shape=circle,draw,inner sep=1pt] (char) {{\scriptsize#1}};}}  
                  ]]);  
      end
    end,

  }
end

-- The actual filter that will look for a code cell and then
-- find its annotations, then process the subsequent OL
function code() 
  -- the localized strings
  local language = param("language", nil);              

  -- walk the blocks and look for annotated code
  -- process the list top down so that we see the outer
  -- code divs first
  return {
    traverse = 'topdown',
    Blocks = function(blocks) 

      -- the user request code annotations value
      local codeAnnotations = param(kCodeAnnotationsParam)

      -- if code annotations is false, then shut it down
      if codeAnnotations ~= false then

        local outputs = pandoc.List()

        -- annotations[annotation-number] = {list of line numbers}
        local pendingAnnotations = nil
        local pendingCellId = nil
        local pendingCodeCell = nil
        local idCounter = 1

        local clearPending = function() 
          pendingAnnotations = nil
          pendingCellId = nil
          pendingCodeCell = nil
        end

        local outputBlockClearPending = function(block)
          if pendingCodeCell then
            outputs:insert(pendingCodeCell)
          end
          outputs:insert(block)
          clearPending()
        end

        local outputBlock = function(block)
          outputs:insert(block)
        end

        local allOutputs = function()
          return outputs
        end

        local resolveCellId = function(identifier) 
          if identifier ~= nil and identifier ~= '' then
            return identifier
          else
            local cellId = 'annotated-cell-' .. tostring(idCounter)
            idCounter = idCounter + 1
            return cellId
          end
        end

        local processCodeCell = function(el, identifier)

          -- select the process for this format's annotations
          local annotationProcessor = processAnnotation
          if _quarto.format.isLatexOutput() then
            annotationProcessor = processLaTeXAnnotation
          end

          -- resolve annotations
          local resolvedCodeBlock, annotations = resolveCellAnnotes(el, annotationProcessor)
          if annotations and next(annotations) ~= nil then
            -- store the annotations and  cell info
            pendingAnnotations = annotations
            pendingCellId = identifier
            
            -- decorate the cell and return it
            if codeAnnotations ~= kCodeAnnotationStyleNone then
              resolvedCodeBlock.attr.classes:insert(kDataCodeAnnonationClz);
            end
            return resolvedCodeBlock
          else
            return nil
          end
        end

        for i, block in ipairs(blocks) do
          if block.t == 'Div' and block.attr.classes:find('cell') then
            -- walk to find the code and 
            local processedAnnotation = false
            local resolvedBlock = pandoc.walk_block(block, {
              CodeBlock = function(el)
                if el.attr.classes:find('cell-code') then
                  
                  local cellId = resolveCellId(el.attr.identifier)
                  local codeCell = processCodeCell(el, cellId)
                  if codeCell then
                    processedAnnotation = true
                    if codeAnnotations ~= kCodeAnnotationStyleNone then
                      codeCell.attr.identifier = cellId;
                    end
                  end
                  return codeCell
                end
              end
            })
            if processedAnnotation then
              pendingCodeCell = resolvedBlock
            else
              outputBlock(resolvedBlock)
            end
          elseif block.t == 'CodeBlock'  then
            -- don't process code cell output here - we'll get it above
            if not block.attr.classes:find('cell-code') then

              local cellId = resolveCellId(block.attr.identifier)
              local codeCell = processCodeCell(block, cellId)
              if codeCell then
                if codeAnnotations ~= kCodeAnnotationStyleNone then
                  codeCell.attr.identifier = cellId;
                end
                outputBlock(codeCell)
              else
                outputBlockClearPending(block)
              end
            else
              outputBlockClearPending(block)
            end
          elseif block.t == 'OrderedList' and pendingAnnotations ~= nil and next(pendingAnnotations) ~= nil then
            -- There are pending annotations, which means this OL is immediately after
            -- a code cell with annotations. Use to emit a DL describing the code
            local items = pandoc.List()
            for i, v in ipairs(block.content) do
              -- find the annotation for this OL
              local annotationNumber = block.start + i - 1

              local annoteId = toAnnoteId(annotationNumber)
              local annotation = pendingAnnotations[annoteId]
              if annotation then

                local lineNumMeta = lineNumberMeta(annotation)

                -- compute the term for the DT
                local term = ""
                if _quarto.format.isLatexOutput() then
                  term = latexListPlaceholder(annotationNumber)
                else
                  if lineNumMeta.count == 1 then
                    term = language[kCodeLine] .. " " .. lineNumMeta.text;
                  else
                    term = language[kCodeLines] .. " " .. lineNumMeta.text;
                  end
                end

                -- compute the definition for the DD
                local definitionContent = v[1].content 
                local annotationToken = tostring(annotationNumber);

                -- Only output span for certain formats (HTML)
                -- for markdown / gfm we should drop the spans
                local definition = nil
                if _quarto.format.isHtmlOutput() then
                  definition = pandoc.Span(definitionContent, {
                    [kDataCodeCellTarget] = pendingCellId,
                    [kDataCodeCellLines] = lineNumMeta.lineNumbers,
                    [kDataCodeCellAnnotation] = annotationToken
                  });
                else 
                  definition = pandoc.Plain(definitionContent)
                end

                -- find the lines that annotate this and convert to a DL
                items:insert({
                  term,
                  definition})
              else
                -- there was an OL item without a corresponding annotation
                warn("List item " .. tostring(i) .. " has no corresponding annotation in the code cell\n(" .. pandoc.utils.stringify(v) ..  ")")
              end
            end

            -- add the definition list
            local dl = pandoc.DefinitionList(items)

            -- if there is a pending code cell, then insert into that and add it
            if codeAnnotations ~= kCodeAnnotationStyleNone then
              if pendingCodeCell ~= nil then
                -- wrap the definition list in a cell
                local dlDiv = pandoc.Div({dl}, pandoc.Attr("", {kCellAnnotationClass}))
                pendingCodeCell.content:insert(2, dlDiv)
                outputBlock(pendingCodeCell)
                clearPending();
              else
                outputBlockClearPending(dl)
              end
            end
          else
            outputBlockClearPending(block)
          end
        end
        return allOutputs()
      end
    end
  }
end