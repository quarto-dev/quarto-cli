-- citation-title.lua
-- Copyright (C) 2026 Posit Software, PBC

-- Converts the title used for the document citation (citation.title, else
-- title) from markdown to CSL rich text and records it as an input trait, so
-- the appendix citation, the BibTeX citation and the Google Scholar metadata
-- do not show the raw YAML string.
function citation_title()
  local kCitationTitle = _quarto.modules.constants.kCitationTitle

  -- CSL rich text understands these elements only
  local allowedTags = { i = true, b = true, sup = true, sub = true }

  local function toInlines(value)
    local kind = quarto.utils.type(value)
    if kind == 'Inlines' then
      return value
    elseif kind == 'Blocks' then
      return pandoc.utils.blocks_to_inlines(value, { pandoc.Space() })
    elseif kind == 'string' then
      return pandoc.Inlines(value)
    end
    return nil
  end

  local function isBlank(inlines)
    return pandoc.utils.stringify(inlines):match("^%s*$") ~= nil
  end

  local function nonEmptyInlines(value)
    local inlines = toInlines(value)
    if inlines ~= nil and not isBlank(inlines) then
      return inlines
    end
    return nil
  end

  local function isChapterNumber(el)
    return el.t == 'Span' and el.classes:includes('chapter-number')
  end

  local function isSeparator(el)
    return el.t == 'Space' or el.t == 'SoftBreak' or
      (el.t == 'Str' and el.text:match("^[%s\u{a0}]*$") ~= nil)
  end

  -- The book chapter number is part of the chapter title, not of the work's
  local function dropChapterNumber(inlines)
    return inlines:walk({
      Inlines = function(list)
        local result = pandoc.Inlines({})
        local i = 1
        while i <= #list do
          if isChapterNumber(list[i]) then
            i = i + 1
            while i <= #list and isSeparator(list[i]) do
              i = i + 1
            end
          else
            result:insert(list[i])
            i = i + 1
          end
        end
        return result
      end
    })
  end

  -- csljson drops raw inlines: keep the tags CSL supports as literal text and
  -- remove every other raw HTML tag
  local function keepCslHtmlTags(inlines)
    return inlines:walk({
      RawInline = function(raw)
        if raw.format ~= 'html' then
          return nil
        end
        local slash, name, rest = raw.text:match("^<%s*(/?)%s*(%a%w*)(.-)>$")
        if name ~= nil and allowedTags[name:lower()] and
            (rest == "" or rest:match("^[%s/]") ~= nil) then
          return pandoc.Str("<" .. slash .. name:lower() .. ">")
        end
        return {}
      end
    })
  end

  local function toCslTitle(inlines)
    local doc = pandoc.Pandoc({}, pandoc.Meta({
      references = { { id = "title", type = "webpage", title = inlines } }
    }))
    local csl = quarto.json.decode(pandoc.write(doc, "csljson"))
    return csl[1] and csl[1].title or ""
  end

  return {
    Meta = function(meta)
      if not _quarto.format.isHtmlOutput() then
        return nil
      end

      local source = nil
      if quarto.utils.type(meta.citation) == 'table' then
        source = nonEmptyInlines(meta.citation.title)
      end
      if source == nil then
        source = nonEmptyInlines(meta.title)
      end

      local title = ""
      if source ~= nil then
        title = toCslTitle(keepCslHtmlTags(dropChapterNumber(source)))
      end
      -- an empty string tells TypeScript there is no title to fall back on
      quarto_global_state.results.inputTraits[kCitationTitle] = title
      return nil
    end
  }
end
