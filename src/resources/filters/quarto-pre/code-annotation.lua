-- code.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("modules/constants")


local hasAnnotations = false

function isAnnotationCell(el) 
  return el and is_regular_node(el, "Div") and el.attr.classes:includes(constants.kCellAnnotationClass)
end
-- annotations appear at the end of the line and are of the form
-- # <1> 
-- where they start with a comment character valid for that code cell
-- and they contain a number which is the annotation number in the
-- OL that will appear after the annotation


-- This provider will yield functions for a particular language that 
-- can be used to resolve annotation numbers and strip them from source 
-- code
local function annoteProvider(lang) 
  local commentChars = constants.kLangCommentChars[lang] or constants.kDefaultCodeAnnotationComment
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

local function toLines(s)
  if s:sub(-1)~="\n" then s=s.."\n" end
  return s:gmatch("(.-)\n")
end

-- Finds annotations in a code cell and returns 
-- the annotations as well as a code cell that
-- removes the annotations
local function resolveCellAnnotes(codeBlockEl, processAnnotation) 

  -- The start line, this may be shifted for cases like 
  -- fenced code blocks, which will have additional code injected
  -- and so require an adjusted start line
  local defaultStartLine = 1 

  -- collect any annotations on this code cell
  local lang = codeBlockEl.attr.classes[1] 
  -- handle fenced-echo block which will have no language
  if lang == "cell-code" then 
    _, _, matchedLang = string.find(codeBlockEl.text, "^`+%{%{([^%}]*)%}%}")
    lang = matchedLang or lang
  elseif lang ~= nil and startsWith(lang, '{{') then
    _, _, matchedLang = string.find(lang, "{{+(.-)}}+")
    if matchedLang then
      lang = matchedLang
      defaultStartLine = defaultStartLine + 1
    end
  end



  local annotationProvider = annoteProvider(lang)
  if annotationProvider ~= nil then
    local annotations = {}
    local code = codeBlockEl.text
    
    local outputs = pandoc.List({})
    local i = 1
    local offset = codeBlockEl.attr.attributes['startFrom'] or defaultStartLine
    for line in toLines(code) do
  
      -- Look and annotation
      local annoteNumber = annotationProvider.annotationNumber(line)
      if annoteNumber then
        -- Capture the annotation number and strip it
        local annoteId = toAnnoteId(annoteNumber)
        local lineNumbers = annotations[annoteId]
        if lineNumbers == nil then
          lineNumbers = pandoc.List({})
        end
        -- line numbers stored for targetting annotations line needs to take into account possible startFrom attribute
        lineNumbers:insert(offset - 1 + i)
        annotations[annoteId] = lineNumbers
        outputs:insert(processAnnotation(line, annoteNumber, annotationProvider))
      else
        outputs:insert(line)
      end
      i = i + 1
    end    

    -- if we capture annotations, then replace the code source
    -- code, stripping annotation comments
    if annotations and next(annotations) ~= nil then
      local outputText = ""
      for i, output in ipairs(outputs) do
        outputText = outputText .. output
        if i < #outputs then
          outputText = outputText .. '\n'
        end
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
  if param(constants.kCodeAnnotationsParam) == constants.kCodeAnnotationStyleNone then
    local replaced = annotationProvider.stripAnnotation(line, annoteNumber) 
    return replaced
  else
    if hasHighlighting then
      -- highlighting is enabled, allow the comment through
      local placeholderComment = annotationProvider.createComment("<" .. tostring(annoteNumber) .. ">")
      local replaced = annotationProvider.replaceAnnotation(line, annoteNumber, percentEscape(" " .. placeholderComment)) 
      return replaced
    else
      -- no highlighting enabled, ensure we use a standard comment character
      local placeholderComment = "%% (" .. tostring(annoteNumber) .. ")"
      local replaced = annotationProvider.replaceAnnotation(line, annoteNumber, placeholderComment) 
      return replaced
    end
  end
end

function processAsciidocAnnotation(line, annoteNumber, annotationProvider)
  if param(constants.kCodeAnnotationsParam) == constants.kCodeAnnotationStyleNone then
    local replaced = annotationProvider.replaceAnnotation(line, annoteNumber, '') 
    return replaced
  else
    local replaced = annotationProvider.replaceAnnotation(line, annoteNumber, " <" .. tostring(annoteNumber) .. ">") 
    return replaced
  end
end

function processAnnotation(line, annoteNumber, annotationProvider)
    -- For all other formats, just strip the annotation- the definition list is converted
    -- to be based upon line numbers. 
        local stripped = annotationProvider.stripAnnotation(line, annoteNumber)
    return stripped
end

function code_meta()
  return {
    Meta = function(meta)
      if _quarto.format.isLatexOutput() and hasAnnotations and param(constants.kCodeAnnotationsParam) ~= constants.kCodeAnnotationStyleNone then
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
function code_annotations()
  -- the localized strings
  local language = param("language", nil)

  -- an id counter to provide nice numeric ids to cell
  local idCounter = 1

  -- walk the blocks and look for annotated code
  -- process the list top down so that we see the outer
  -- code divs first
  local code_filter = {
    traverse = 'topdown',
    Blocks = function(blocks) 

      -- the user request code annotations value
      local codeAnnotations = param(constants.kCodeAnnotationsParam)

      -- if code annotations is false, then shut it down
      if codeAnnotations ~= false then

        local outputs = pandoc.List()

        -- annotations[annotation-number] = {list of line numbers}
        local pendingAnnotations = nil
        local pendingCellId = nil
        local pendingCodeCell = nil

        local clearPending = function()          
          pendingAnnotations = nil
          pendingCellId = nil
          pendingCodeCell = nil
        end
   
        local outputBlock = function(block)
          outputs:insert(block)
        end
        
        local flushPending = function()
          if pendingCodeCell then
            outputBlock(pendingCodeCell)
          end
          clearPending()
        end

        local outputBlockClearPending = function(block)
          flushPending()
          outputBlock(block)
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
          elseif _quarto.format.isAsciiDocOutput() then
            annotationProcessor = processAsciidocAnnotation
          end

          -- resolve annotations
          local resolvedCodeBlock, annotations = resolveCellAnnotes(el, annotationProcessor)
          if annotations and next(annotations) ~= nil then
            -- store the annotations and  cell info
            pendingAnnotations = annotations
            pendingCellId = identifier
            
            -- decorate the cell and return it
            if codeAnnotations ~= constants.kCodeAnnotationStyleNone then
              resolvedCodeBlock.attr.classes:insert(constants.kDataCodeAnnonationClz);
            end
            return resolvedCodeBlock
          else
            return nil
          end
        end

        for i, block in ipairs(blocks) do
          local found = is_regular_node(block, "Div") and block.attr.classes:find('cell')
          if is_custom_node(block) then
            local custom = _quarto.ast.resolve_custom_data(block)
            if custom then
              found = found or (custom.classes or pandoc.List({})):find('cell')
            end
          end
          if found then
            -- Process executable code blocks 
            -- In the case of executable code blocks, we actually want
            -- to shift the OL up above the output, so we hang onto this outer
            -- cell so we can move the OL up into it if there are annotations
            local processedAnnotation = false
            local resolvedBlock = _quarto.ast.walk(block, {
              CodeBlock = function(el)
                if el.attr.classes:find('cell-code') then
                  local cellId = resolveCellId(el.attr.identifier)
                  local codeCell = processCodeCell(el, cellId)
                  if codeCell then
                    processedAnnotation = true
                    if codeAnnotations ~= constants.kCodeAnnotationStyleNone then
                      codeCell.attr.identifier = cellId;
                    end
                  end
                  return codeCell
                end
              end
            })
            if processedAnnotation then
              -- we found annotations, so hand onto this cell
              pendingCodeCell = resolvedBlock
            else
              -- no annotations, just output it
              outputBlock(resolvedBlock)
            end

          elseif block.t == "Div" then
            local isDecoratedCodeBlock = is_custom_node(block, "DecoratedCodeBlock")
            if isDecoratedCodeBlock then
              -- If there is a pending code cell and we get here, just
              -- output the pending code cell and continue
              flushPending()

              if #block.content == 1 and #block.content[1].content == 1 then
                -- Find the code block and process that
                local codeblock = block.content[1].content[1]
                
                local cellId = resolveCellId(codeblock.attr.identifier)
                local codeCell = processCodeCell(codeblock, cellId)
                if codeCell then
                  if codeAnnotations ~= constants.kCodeAnnotationStyleNone then
                    codeCell.attr.identifier = cellId;
                  end
                  block.content[1].content[1] = codeCell
                  outputBlock(block)
                else
                  outputBlockClearPending(block)
                end
              else
                outputBlockClearPending(block)
              end
            else
              outputBlockClearPending(block)
            end          
          elseif block.t == 'CodeBlock'  then
            -- don't process code cell output here - we'll get it above
            -- This processes non-executable code blocks
            if not block.attr.classes:find('cell-code') then

              -- If there is a pending code cell and we get here, just
              -- output the pending code cell and continue
              flushPending()

              local cellId = resolveCellId(block.attr.identifier)
              local codeCell = processCodeCell(block, cellId)
              if codeCell then
                if codeAnnotations ~= constants.kCodeAnnotationStyleNone then
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
                elseif _quarto.format.isAsciiDocOutput() then
                  term = "<" .. tostring(annotationNumber) .. ">"
                else
                  if lineNumMeta.count == 1 then
                    term = language[constants.kCodeLine] .. " " .. lineNumMeta.text;
                  else
                    term = language[constants.kCodeLines] .. " " .. lineNumMeta.text;
                  end
                end

                -- compute the definition for the DD
                local definitionContent = v[1].content 
                local annotationToken = tostring(annotationNumber);

                -- Only output span for certain formats (HTML)
                -- for markdown / gfm we should drop the spans
                local definition = nil
                if _quarto.format.isHtmlOutput() then
                  -- use an attribute list since it then guarantees that the
                  -- order of the attributes is consistent from run to run
                  local attribs = pandoc.AttributeList {
                    {constants.kDataCodeCellTarget, pendingCellId},
                    {constants.kDataCodeCellLines, lineNumMeta.lineNumbers},
                    {constants.kDataCodeCellAnnotation, annotationToken}
                  }
                  definition = pandoc.Span(definitionContent, pandoc.Attr(attribs))
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
            local dl
            if _quarto.format.isAsciiDocOutput() then
              local formatted = pandoc.List()
              for _i,v in ipairs(items) do
                local annotationMarker = v[1] .. ' '
                local definition = v[2]
                tprepend(definition.content, {annotationMarker})
                formatted:insert(definition)
              end
              dl = pandoc.Div(formatted)
            else
              dl = pandoc.DefinitionList(items)
            end

            -- if there is a pending code cell, then insert into that and add it
            if codeAnnotations ~= constants.kCodeAnnotationStyleNone then
              if pendingCodeCell ~= nil then
                -- wrap the definition list in a cell
                local dlDiv = pandoc.Div({dl}, pandoc.Attr("", {constants.kCellAnnotationClass}))
                if is_custom_node(pendingCodeCell) then
                  local custom = _quarto.ast.resolve_custom_data(pendingCodeCell) or pandoc.Div({}) -- won't happen but the Lua analyzer doesn't know it
                  custom.content:insert(2, dlDiv)
                else
                  pendingCodeCell.content:insert(2, dlDiv)
                end
                flushPending()
              else
                outputBlockClearPending(dl)
              end
            else
              flushPending()
            end
          else
            outputBlockClearPending(block)
          end
        end

        -- Be sure to flush any pending Code Cell (usually when only annotated cell without annotation and no other following blocks)
        flushPending()

        return allOutputs()
      end
    end
  }

  -- return code_filter
  return {
    Pandoc = function(doc)
      local codeAnnotations = param(constants.kCodeAnnotationsParam)

      -- if code annotations is false, then don't even walk it
      if codeAnnotations == false then
        return nil
      end
      
      return _quarto.ast.walk(doc, code_filter)
    end
  }
end
