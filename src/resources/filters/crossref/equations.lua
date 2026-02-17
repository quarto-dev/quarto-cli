-- equations.lua
-- Copyright (C) 2020-2026 Posit Software, PBC

-- process all equations
function equations()
  return {
    Para = process_equations,
    Plain = process_equations
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
      -- Check "starts with" not complete match: Pandoc splits {#eq-label alt="..."} across elements
      elseif el.t == "Str" and el.text:match("^{#eq%-") then
        -- Collect attribute block: {#eq-label alt="..."} may span multiple elements
        local attrText, consumed = collectAttrBlock(inlines, i)

        if attrText then
          -- Parse to extract label and optional attributes (e.g., alt for Typst)
          local label, attributes = parseRefAttr(attrText)
          if not label then
            local _, extracted = extractRefLabel("eq", attrText)
            label = extracted
          end

          local order = indexNextOrder("eq")
          indexAddEntry(label, nil, order)

          local eq = mathInlines[1]
          local alt = attributes and attributes["alt"] or nil
          local eqInlines = renderEquation(eq, label, alt, order)
          targetInlines:extend(eqInlines)

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

-- Render equation output for all formats.
-- The alt parameter is only used for Typst output (accessibility).
function renderEquation(eq, label, alt, order)
  local result = pandoc.Inlines{}

  if _quarto.format.isLatexOutput() then
    result:insert(pandoc.RawInline("latex", "\\begin{equation}"))
    result:insert(pandoc.Span(pandoc.RawInline("latex", eq.text), pandoc.Attr(label)))

    -- Pandoc 3.1.7 started outputting a shadow section with a label as a link target
    -- which would result in two identical labels being emitted.
    -- https://github.com/jgm/pandoc/issues/9045
    -- https://github.com/lierdakil/pandoc-crossref/issues/402
    result:insert(pandoc.RawInline("latex", "\\end{equation}"))

  elseif _quarto.format.isTypstOutput() then
    local is_block = eq.mathtype == "DisplayMath" and "true" or "false"
    -- Escape quotes in alt text for Typst string literal
    -- First normalize curly quotes to straight quotes (Pandoc may apply smart quotes)
    local alt_param = ""
    if alt then
      local escaped_alt = alt:gsub("“", '"'):gsub("”", '"')
      escaped_alt = escaped_alt:gsub("‘", "'"):gsub("’", "'")
      escaped_alt = escaped_alt:gsub('"', '\\"')
      alt_param = ", alt: \"" .. escaped_alt .. "\""
    end
    -- Use equation-numbering variable defined in template
    -- (simple "(1)" for articles, chapter-based function for books)
    result:insert(pandoc.RawInline("typst",
      "#math.equation(block: " .. is_block .. ", numbering: equation-numbering" .. alt_param .. ", [ "))
    result:insert(eq)
    result:insert(pandoc.RawInline("typst", " ])<" .. label .. ">"))

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
    result:insert(pandoc.Span(eq, pandoc.Attr(label)))
  end

  return result
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


-- Collect a complete attribute block from inline elements.
--
-- Pandoc tokenises `{#eq-label alt="description"}` into multiple elements:
--   Str "{#eq-label", Space, Str "alt=", Quoted [...], Str "}"
--
-- This function reassembles these elements into a single string for parseRefAttr().
-- Quoted elements are reconstructed with escaped inner quotes to preserve the
-- original attribute syntax.
--
-- Returns: collected text (string), number of elements consumed (number)
function collectAttrBlock(inlines, startIndex)
  local first = inlines[startIndex]
  if not first or first.t ~= "Str" then
    return nil, 0
  end

  local collected = first.text
  local consumed = 1

  if collected:match("}$") then
    return collected, consumed
  end

  for j = startIndex + 1, #inlines do
    local el = inlines[j]
    if el.t == "Str" then
      collected = collected .. el.text
      consumed = consumed + 1
    elseif el.t == "Space" then
      collected = collected .. " "
      consumed = consumed + 1
    elseif el.t == "Quoted" then
      local quote = el.quotetype == "DoubleQuote" and '"' or "'"
      local content = pandoc.utils.stringify(el.content)
      if el.quotetype == "DoubleQuote" then
        content = content:gsub('"', '\\"')
      else
        content = content:gsub("'", "\\'")
      end
      collected = collected .. quote .. content .. quote
      consumed = consumed + 1
    else
      break
    end
    if collected:match("}$") then
      break
    end
  end

  if collected:match("^{#eq%-[^}]+}$") then
    return collected, consumed
  end

  return nil, 0
end


-- Parse a Pandoc attribute block string into identifier and attributes.
--
-- Uses pandoc.read() with a dummy header to leverage Pandoc's native attribute
-- parser, avoiding fragile regex-based parsing.
--
-- Single-quoted attributes (e.g., alt='text') must be converted to double quotes
-- because Pandoc's attribute syntax only supports double-quoted values.
-- The conversion uses a three-step process:
--   1. Protect escaped single quotes (\') with a placeholder.
--   2. Convert key='value' to key="value", escaping any internal double quotes.
--   3. Restore any remaining placeholders to literal single quotes.
--
-- Returns: identifier (string), attributes (table)
function parseRefAttr(text)
  if not text then return nil, nil end

  local placeholder = "\x00ESC_SQUOTE\x00"
  text = text:gsub("\\'", placeholder)
  text = text:gsub("(%w+)='([^']*)'", function(key, value)
    value = value:gsub(placeholder, "'")
    value = value:gsub('"', '\\"')
    return key .. '="' .. value .. '"'
  end)
  text = text:gsub(placeholder, "'")

  -- Normalise spaces around = in attributes (alt = "value" -> alt="value")
  text = text:gsub("(%w+)%s*=%s*(['\"])", "%1=%2")

  local parsed = pandoc.read("## " .. text, "markdown")
  if parsed and parsed.blocks[1] and parsed.blocks[1].attr then
    local attr = parsed.blocks[1].attr
    return attr.identifier, attr.attributes
  end
  return nil, nil
end
