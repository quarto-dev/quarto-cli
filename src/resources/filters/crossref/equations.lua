-- equations.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- process all equations
function equations()
  return {
    Para = process_equations,
    Plain = process_equations,
    Div = process_equation_div
  }
end

function process_equations(blockEl)

  -- alias inlines
  local inlines = blockEl.content

  -- do nothing if there is no math herein
  if inlines:find_if(isDisplayMath) == nil then
    return nil
  end

  local mathInlines = nil
  local targetInlines = pandoc.Inlines{}
  local skipUntil = 0

  for i, el in ipairs(inlines) do
    -- see if we need special handling for pending math, if
    -- we do then track whether we should still process the
    -- inline at the end of the loop
    local processInline = true

    -- Skip elements that were consumed as part of a multi-element attribute block
    if i <= skipUntil then
      processInline = false
      goto continue
    end
    if mathInlines then
      if el.t == "Space" then
        mathInlines:insert(el)
        processInline = false
      elseif el.t == "Str" and startsWithEqLabel(el.text) then
        -- Collect attribute block: {#eq-label alt="..."} may span multiple elements
        local attrText, consumed = collectAttrBlock(inlines, i)

        if attrText then
          -- Parse to extract label and optional attributes (e.g., alt for Typst)
          local label, attributes = parseRefAttr(attrText)
          if not label then
            label = attrText:match("{#(eq%-[^ }]+)")
          end

          local order = indexNextOrder("eq")
          indexAddEntry(label, nil, order)

          local eq = mathInlines[1]

          if _quarto.format.isLatexOutput() then
            targetInlines:insert(pandoc.RawInline("latex", "\\begin{equation}"))
            targetInlines:insert(pandoc.Span(pandoc.RawInline("latex", eq.text), pandoc.Attr(label)))

            -- Pandoc 3.1.7 started outputting a shadow section with a label as a link target
            -- which would result in two identical labels being emitted.
            -- https://github.com/jgm/pandoc/issues/9045
            -- https://github.com/lierdakil/pandoc-crossref/issues/402
            targetInlines:insert(pandoc.RawInline("latex", "\\end{equation}"))

          elseif _quarto.format.isTypstOutput() then
            local is_block = eq.mathtype == "DisplayMath" and "true" or "false"
            -- Alt attribute for Typst accessibility (ignored for other formats)
            local alt_param = (attributes and attributes["alt"])
              and (", alt: \"" .. attributes["alt"] .. "\"") or ""
            targetInlines:insert(pandoc.RawInline("typst",
              "#math.equation(block: " .. is_block .. ", numbering: \"(1)\"" .. alt_param .. ", [ "))
            targetInlines:insert(eq)
            targetInlines:insert(pandoc.RawInline("typst", " ])<" .. label .. ">"))
          else
            local eqNumber = eqQquad
            local mathMethod = param("html-math-method", nil)
            if type(mathMethod) == "table" and mathMethod["method"] then
              mathMethod = mathMethod["method"]
            end
            if _quarto.format.isHtmlOutput() and (mathMethod == "mathjax" or mathMethod == "katex") then
              eqNumber = eqTag
            end
            eq.text = eq.text .. " " .. eqNumber(inlinesToString(numberOption("eq", order)))
            local span = pandoc.Span(eq, pandoc.Attr(label))
            targetInlines:insert(span)
          end

          -- Skip consumed elements and reset state
          skipUntil = i + consumed - 1
          mathInlines = nil
          processInline = false
        else
          targetInlines:extend(mathInlines)
          mathInlines = nil
        end
      else
        targetInlines:extend(mathInlines)
        mathInlines = nil
      end
    end
    ::continue::

    -- process the inline unless it was already taken care of above
    if processInline then
      if isDisplayMath(el) then
          mathInlines = pandoc.List()
          mathInlines:insert(el)
        else
          targetInlines:insert(el)
      end
    end

  end

  -- flush any pending math inlines
  if mathInlines then
    targetInlines:extend(mathInlines)
  end

  -- return the processed list
  blockEl.content = targetInlines
  return blockEl
 
end

function eqTag(eq)
  return "\\tag{" .. eq .. "}"
end

function eqQquad(eq)
  return "\\qquad(" .. eq .. ")"
end

function isDisplayMath(el)
  return el.t == "Math" and el.mathtype == "DisplayMath"
end

-- Check if text starts with an equation label pattern {#eq-
function startsWithEqLabel(text)
  return text and text:match("^{#eq%-")
end

-- Collect a complete attribute block from inline elements.
--
-- Pandoc tokenises `{#eq-label alt="description"}` into multiple elements:
--   Str "{#eq-label", Space, Str "alt=", Quoted [...], Str "}"
--
-- This function collects and joins these elements into a single string
-- that can be parsed by parseRefAttr().
--
-- Returns: collected text (string), number of elements consumed (number)
function collectAttrBlock(inlines, startIndex)
  local first = inlines[startIndex]
  if not first or first.t ~= "Str" then
    return nil, 0
  end

  local collected = first.text
  local consumed = 1

  -- Simple case: complete in one element (e.g., {#eq-label})
  if collected:match("}$") then
    return collected, consumed
  end

  -- Collect subsequent elements until closing brace
  for j = startIndex + 1, #inlines do
    local el = inlines[j]
    if el.t == "Str" then
      collected = collected .. el.text
      consumed = consumed + 1
    elseif el.t == "Space" then
      collected = collected .. " "
      consumed = consumed + 1
    elseif el.t == "Quoted" then
      -- Pandoc parses quoted strings into Quoted elements
      local quote = el.quotetype == "DoubleQuote" and '"' or "'"
      collected = collected .. quote .. pandoc.utils.stringify(el.content) .. quote
      consumed = consumed + 1
    else
      break
    end
    if collected:match("}$") then
      break
    end
  end

  -- Validate: must be a complete attribute block
  if collected:match("^{#eq%-[^}]+}$") then
    return collected, consumed
  end

  return nil, 0
end

-- Process equation divs with optional alt-text attribute.
-- Supports syntax: ::: {#eq-label alt="description"} $$ ... $$ :::
-- The alt attribute is only used for Typst output (accessibility).
function process_equation_div(divEl)
  local label = divEl.attr.identifier
  if not label or not label:match("^eq%-") then
    return nil
  end

  -- Find display math inside the div
  local eq = nil
  _quarto.ast.walk(divEl, {
    Math = function(el)
      if el.mathtype == "DisplayMath" then
        eq = el
      end
    end
  })

  if not eq then
    return nil
  end

  local order = indexNextOrder("eq")
  indexAddEntry(label, nil, order)

  -- Alt attribute for Typst accessibility (ignored for other formats)
  local alt = divEl.attr.attributes["alt"]

  if _quarto.format.isLatexOutput() then
    return pandoc.Para({
      pandoc.RawInline("latex", "\\begin{equation}"),
      pandoc.Span(pandoc.RawInline("latex", eq.text), pandoc.Attr(label)),
      pandoc.RawInline("latex", "\\end{equation}")
    })
  elseif _quarto.format.isTypstOutput() then
    local alt_param = alt and (", alt: \"" .. alt .. "\"") or ""
    return pandoc.Para({
      pandoc.RawInline("typst",
        "#math.equation(block: true, numbering: \"(1)\"" .. alt_param .. ", [ "),
      eq,
      pandoc.RawInline("typst", " ])<" .. label .. ">")
    })
  else
    local eqNumber = eqQquad
    local mathMethod = param("html-math-method", nil)
    if type(mathMethod) == "table" and mathMethod["method"] then
      mathMethod = mathMethod["method"]
    end
    if _quarto.format.isHtmlOutput() and (mathMethod == "mathjax" or mathMethod == "katex") then
      eqNumber = eqTag
    end
    eq.text = eq.text .. " " .. eqNumber(inlinesToString(numberOption("eq", order)))
    return pandoc.Para({pandoc.Span(eq, pandoc.Attr(label))})
  end
end
