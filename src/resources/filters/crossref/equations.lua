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
      local multiRow = isDisplayMath(el) and not followedByEqAttr(inlines, i)
        and renderMultiRowEquation(el)
      if multiRow then
          targetInlines:extend(multiRow)
      elseif isDisplayMath(el) then
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

-- does a {#eq-...} attribute follow the inline at index i?
function followedByEqAttr(inlines, i)
  for j = i + 1, #inlines do
    local el = inlines[j]
    if el.t ~= "Space" then
      return el.t == "Str" and el.text:match("^{#eq%-") ~= nil
    end
  end
  return false
end

-- math environments whose rows are numbered individually, so each
-- row can carry its own \label{eq-...} (#2275)
local multiRowEnvironments = {
  align = true,
  alignat = true,
  eqnarray = true,
  flalign = true,
  gather = true
}

-- split math at a top level separator (\\ between rows, & between cells),
-- skipping those inside braces or nested environments such as matrices
function splitMath(body, separator)
  local parts = pandoc.List()
  local depth = 0
  local partStart = 1
  local i = 1
  while i <= #body do
    local env = body:match("^\\begin%b{}", i)
    local endEnv = body:match("^\\end%b{}", i)
    local c = body:sub(i, i)
    if env then
      depth = depth + 1
      i = i + #env
    elseif endEnv then
      depth = depth - 1
      i = i + #endEnv
    elseif body:sub(i, i + #separator - 1) == separator and depth == 0 then
      parts:insert(body:sub(partStart, i - 1))
      i = i + #separator
      partStart = i
    elseif c == "\\" then
      -- skip escaped characters such as \{ and \\ in nested content
      i = i + 2
    else
      if c == "{" then
        depth = depth + 1
      elseif c == "}" then
        depth = depth - 1
      end
      i = i + 1
    end
  end
  parts:insert(body:sub(partStart))
  return parts
end

-- convert a TeX math fragment to display style typst math
local function typstDisplayMath(tex)
  if not tex:match("%S") then
    return "[]"
  end
  local doc = pandoc.Pandoc({ pandoc.Plain({ pandoc.Math("InlineMath", tex) }) })
  local typst = pandoc.write(doc, "typst"):gsub("%s+$", "")
  local inner = typst:match("^%$(.*)%$$")
  if inner == nil then
    -- pandoc couldn't convert the math, keep whatever it produced
    return "[" .. typst .. "]"
  end
  return "$display(" .. inner .. ")$"
end

-- Typst has no per-row equation numbering, so lay the environment out as a
-- grid like amsmath does: alternating right/left aligned columns (centered
-- for gather) between flexible margins, and a column for the row numbers.
-- Each number carries its row's label so references can link to it, and is
-- set in math so it uses the math font like other equations' numbers.
local function renderTypstMultiRow(env, rows)
  local columnAlign
  if env == "gather" then
    columnAlign = function() return "center" end
  elseif env == "eqnarray" then
    columnAlign = function(i) return ({ "right", "center", "left" })[(i - 1) % 3 + 1] end
  else
    columnAlign = function(i) return i % 2 == 1 and "right" or "left" end
  end

  local cellRows = pandoc.List()
  local columnCount = 1
  for _, row in ipairs(rows) do
    local cells = splitMath(row.tex, "&")
    columnCount = math.max(columnCount, #cells)
    cellRows:insert(cells)
  end

  local columns = pandoc.List({ "1fr" })
  local aligns = pandoc.List({ "center" })
  local gutters = pandoc.List({ "0pt" })
  for i = 1, columnCount do
    columns:insert("auto")
    aligns:insert(columnAlign(i))
    -- separate each right/left pair from the next, as amsmath does, and
    -- leave a relation's thick space (5mu) where a pair is aligned
    local gutter = "0pt"
    if i < columnCount and env == "eqnarray" then
      gutter = "0.2778em"
    elseif i < columnCount and env ~= "gather" then
      gutter = i % 2 == 0 and "2em" or "0.2778em"
    end
    gutters:insert(gutter)
  end
  columns:extend({ "1fr", "auto" })
  aligns:extend({ "center", "right" })
  gutters:insert("0pt")

  local cells = pandoc.List()
  for r, row in ipairs(rows) do
    cells:insert("[]")
    for i = 1, columnCount do
      cells:insert(typstDisplayMath(cellRows[r][i] or ""))
    end
    cells:insert("[]")
    if row.label then
      cells:insert("[#[$\"(" .. row.number .. ")\"$]<" .. row.label .. ">]")
    else
      cells:insert("[]")
    end
  end

  return "#block(width: 100%, grid(\n" ..
    "  columns: (" .. table.concat(columns, ", ") .. "),\n" ..
    "  column-gutter: (" .. table.concat(gutters, ", ") .. "),\n" ..
    "  row-gutter: 0.65em,\n" ..
    "  align: (col, row) => (" .. table.concat(aligns, ", ") .. ").at(col) + horizon,\n" ..
    "  " .. table.concat(cells, ", ") .. "\n" ..
    "))"
end

-- Render a display math multi-row environment (align, gather, ...) in which
-- rows are labeled with \label{eq-...}. Each labeled row is indexed as an
-- equation and numbered; unlabeled rows are left unnumbered so numbering
-- matches across formats. Returns nil if this isn't such an environment.
function renderMultiRowEquation(eq)
  local env, body = eq.text:match("^%s*\\begin{(%a+)}(.*)\\end{%a+}%s*$")
  if env == nil or not multiRowEnvironments[env] or not body:match("\\label{eq%-") then
    return nil
  end

  local isLatex = _quarto.format.isLatexOutput()
  local mathMethod = param("html-math-method", nil)
  if type(mathMethod) == "table" and mathMethod["method"] then
    mathMethod = mathMethod["method"]
  end
  local useTags = _quarto.format.isHtmlOutput() and (mathMethod == "mathjax" or mathMethod == "katex")

  local labels = pandoc.List()
  local typstRows = pandoc.List()
  local rows = splitMath(body, "\\\\")
  for i, row in ipairs(rows) do
    local label = row:match("\\label{(eq%-[^}]+)}")
    local number = nil
    if label then
      local order = indexNextOrder("eq")
      indexAddEntry(label, nil, order)
      crossref.index.entries[label].multirow = true
      labels:insert(label)
      number = inlinesToString(numberOption("eq", order))
    end
    if row:match("%S") then
      typstRows:insert({
        tex = row:gsub("\\label%b{}", ""):gsub("\\nonumber", ""):gsub("\\notag", ""),
        label = label,
        number = number
      })
    end
    if label then
      if useTags then
        row = row:gsub("\\label{eq%-[^}]+}", function() return eqTag(number) end)
      elseif not isLatex then
        row = row:gsub("\\label{eq%-[^}]+}", function() return eqQquad(number) end)
      end
    elseif row:match("%S") then
      if isLatex then
        row = row .. "\\nonumber "
      elseif useTags then
        row = row .. "\\notag "
      end
    end
    rows[i] = row
  end

  eq.text = "\\begin{" .. env .. "}" .. table.concat(rows, "\\\\") .. "\\end{" .. env .. "}"
  if isLatex then
    -- amsmath numbers the rows and resolves the \label{}s natively
    return pandoc.Inlines({ eq })
  end

  local result = pandoc.Inlines({})
  if _quarto.format.isTypstOutput() then
    result:insert(pandoc.RawInline("typst", renderTypstMultiRow(env, typstRows)))
    -- typst only counts numbered equations, so keep its counter in step
    result:insert(pandoc.RawInline("typst",
      "#counter(math.equation).update(n => n + " .. #labels .. ")"))
  else
    -- wrap the equation in a span per label, so every label's target
    -- contains the equation (e.g. for html hover previews)
    local anchored = eq
    for i = #labels, 1, -1 do
      anchored = pandoc.Span(anchored, pandoc.Attr(labels[i]))
    end
    result:insert(anchored)
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
