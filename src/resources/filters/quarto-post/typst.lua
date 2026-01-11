-- latex.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- renders AST nodes to Typst

-- FIXME Ideally this would go directly on init.lua, but
-- the module path set up doesn't appear to be working there.

local typst = require("modules/typst")
_quarto.format.typst = typst

-- Helper to format marginalia shift parameter
-- auto/true/false are unquoted, "avoid"/"ignore" are quoted strings
local function formatShiftParam(shift)
  if shift == "true" or shift == "false" or shift == "auto" then
    return shift
  else
    return '"' .. shift .. '"'
  end
end

-- Lookup table for citeproc-rendered bibliography entries
-- Maps citation_id -> Inlines (formatted bibliography entry)
local citeprocBibliography = {}

function render_typst()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  local number_depth

  return {
    -- Pass 0: Pre-process citeproc to build bibliography lookup table
    -- This must run before the Cite handler so entries are available
    {
      Pandoc = function(doc)
        -- Only build lookup if using citeproc AND margin citations
        if marginCitations() and quarto.doc.cite_method() == 'citeproc' then
          -- Run citeproc on a copy to get formatted bibliography
          local processed = pandoc.utils.citeproc(doc)

          -- Find the refs div and extract entries
          processed:walk({
            Div = function(div)
              -- Each bibliography entry has id like "ref-citationkey"
              local match = div.identifier:match("^ref%-(.+)$")
              if match then
                -- Extract the formatted content (typically a Para inside the div)
                -- Flatten to Inlines for use in margin notes
                local inlines = pandoc.Inlines({})
                for _, block in ipairs(div.content) do
                  if block.t == "Para" or block.t == "Plain" then
                    if #inlines > 0 then
                      inlines:insert(pandoc.Space())
                    end
                    inlines:extend(block.content)
                  end
                end
                citeprocBibliography[match] = inlines
              end
            end
          })
        end
        return nil  -- Don't modify the document
      end
    },
    {
      Meta = function(m)
        -- This should be a number, but we must represent it as a string,
        -- as numbers are disallowed as metadata values.
        m["toc-depth"] = tostring(PANDOC_WRITER_OPTIONS["toc_depth"])
        m["toc-indent"] = option("toc-indent")
        if m["number-depth"] then
          number_depth = tonumber(pandoc.utils.stringify(m["number-depth"]))
        end
        return m
      end
    },
    {
      Div = function(div)
        -- Handle .column-margin divs (margin notes) using marginalia package
        if div.classes:includes("column-margin") then
          div.classes = div.classes:filter(function(c) return c ~= "column-margin" end)

          -- marginalia uses alignment for baseline/top/bottom positioning
          local alignment = div.attributes.alignment or "baseline"
          div.attributes.alignment = nil

          -- dy is for additional offset (0pt by default)
          local dy = div.attributes.dy or "0pt"
          div.attributes.dy = nil

          -- shift controls overlap prevention (auto, true, false, "avoid", "ignore")
          local shift = div.attributes.shift or "auto"
          div.attributes.shift = nil

          local result = pandoc.Blocks({})
          result:insert(pandoc.RawBlock("typst",
            '#note(alignment: "' .. alignment .. '", dy: ' .. dy .. ', shift: ' .. formatShiftParam(shift) .. ', counter: none)['))
          result:extend(div.content)
          result:insert(pandoc.RawBlock("typst", "]"))
          return result
        end

        -- Handle .block divs
        if div.classes:includes("block") then
          div.classes = div.classes:filter(function(c) return c ~= "block" end)

          local preamble = pandoc.Blocks({})
          local postamble = pandoc.Blocks({})
          preamble:insert(pandoc.RawBlock("typst", "#block("))
          for k, v in pairs(div.attributes) do
            -- FIXME: proper escaping of k and v
            preamble:insert(pandoc.RawBlock("typst", k .. ":" .. v .. ",\n"))
          end
          preamble:insert(pandoc.RawBlock("typst", "[\n"))
          postamble:insert(pandoc.RawBlock("typst", "])\n\n"))

          local result = pandoc.Blocks({})
          result:extend(preamble)
          result:extend(div.content)
          result:extend(postamble)
          return result
        end
      end,
      Span = function(span)
        -- Handle .column-margin spans (inline margin notes) using marginalia package
        if span.classes:includes("column-margin") then
          span.classes = span.classes:filter(function(c) return c ~= "column-margin" end)

          -- marginalia uses alignment for baseline/top/bottom positioning
          local alignment = span.attributes.alignment or "baseline"
          span.attributes.alignment = nil

          -- dy is for additional offset (0pt by default)
          local dy = span.attributes.dy or "0pt"
          span.attributes.dy = nil

          -- shift controls overlap prevention (auto, true, false, "avoid", "ignore")
          local shift = span.attributes.shift or "auto"
          span.attributes.shift = nil

          local result = pandoc.Inlines({})
          result:insert(pandoc.RawInline("typst",
            '#note(alignment: "' .. alignment .. '", dy: ' .. dy .. ', shift: ' .. formatShiftParam(shift) .. ', counter: none)['))
          result:extend(span.content)
          result:insert(pandoc.RawInline("typst", "]"))
          return result
        end
      end,
      -- Note: footnotes with reference-location: margin are handled via Typst show rule
      -- (see definitions.typ) rather than intercepting here, so Pandoc's native
      -- block-to-Typst conversion is preserved for complex footnote content.
      Cite = function(cite)
        -- Show full citations in margin when citation-location: margin
        if marginCitations() then
          noteHasColumns()  -- Activate margin layout

          local use_citeproc = quarto.doc.cite_method() == 'citeproc'

          -- Keep original Cite element (Pandoc renders it with locator inline)
          -- Append margin note with full bibliographic entries
          local result = pandoc.Inlines({})
          result:insert(cite)

          -- Open margin note
          result:insert(pandoc.RawInline("typst",
            "#note(alignment: \"baseline\", shift: auto, counter: none)[#set text(size: 0.85em)\n"))

          -- Add bibliography entries for each citation
          local first = true
          for _, c in ipairs(cite.citations) do
            if not first then
              result:insert(pandoc.RawInline("typst", "\n"))
            end
            first = false

            if use_citeproc and citeprocBibliography[c.id] then
              -- Use pre-rendered citeproc content (Pandoc will convert to Typst)
              result:extend(citeprocBibliography[c.id])
            else
              -- Use native Typst citation
              result:insert(pandoc.RawInline("typst", "#cite(<" .. c.id .. ">, form: \"full\")"))
            end
          end

          -- Close margin note
          result:insert(pandoc.RawInline("typst", "]"))
          return result
        end
      end,
      Header = function(el)
        if number_depth and el.level > number_depth then
          el.classes:insert("unnumbered")
        end
        if not el.classes:includes("unnumbered") and not el.classes:includes("unlisted") then
          return nil
        end
        local params = pandoc.List({
          {"level", el.level},
        })
        if el.classes:includes("unnumbered") then
          params:insert({"numbering", pandoc.RawInline("typst", "none")})
        end
        if el.classes:includes("unlisted") then
          params:insert({"outlined", false})
        end
        params:insert({_quarto.format.typst.as_typst_content(el.content)})
        return _quarto.format.typst.function_call("heading", params)
      end,
    }
  }
end

function render_typst_fixups()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  return {
    traverse = "topdown",
    Image = function(image)
      image = _quarto.modules.mediabag.resolve_image_from_url(image) or image
      -- REMINDME 2024-09-01
      -- work around until https://github.com/jgm/pandoc/issues/9945 is fixed
      local height_as_number = tonumber(image.attributes["height"])
      local width_as_number = tonumber(image.attributes["width"])
      if image.attributes["height"] ~= nil and type(height_as_number) == "number" then
        image.attributes["height"] = tostring(image.attributes["height"] / PANDOC_WRITER_OPTIONS.dpi) .. "in"
      end
      if image.attributes["width"] ~= nil and type(width_as_number) == "number" then
        image.attributes["width"] = tostring(image.attributes["width"] / PANDOC_WRITER_OPTIONS.dpi) .. "in"
      end

      -- Workaround for Pandoc not passing alt text to Typst image() calls
      -- See: https://github.com/jgm/pandoc/pull/11394
      local alt_text = image.attributes["alt"]
      if (alt_text == nil or alt_text == "") and #image.caption > 0 then
        alt_text = pandoc.utils.stringify(image.caption)
      end

      if alt_text and #alt_text > 0 then
        -- When returning RawInline instead of Image, Pandoc won't write mediabag
        -- entries to disk, so we must do it explicitly
        local src = image.src
        local mediabagPath = _quarto.modules.mediabag.write_mediabag_entry(src)
        if mediabagPath then
          src = mediabagPath
        end

        -- Build image() parameters
        local params = {}

        -- Source path (escape backslashes for Windows paths)
        src = src:gsub('\\', '\\\\')
        table.insert(params, '"' .. src .. '"')

        -- Alt text second (escape backslashes and quotes)
        local escaped_alt = alt_text:gsub('\\', '\\\\'):gsub('"', '\\"')
        table.insert(params, 'alt: "' .. escaped_alt .. '"')

        -- Height if present
        if image.attributes["height"] then
          table.insert(params, 'height: ' .. image.attributes["height"])
        end

        -- Width if present
        if image.attributes["width"] then
          table.insert(params, 'width: ' .. image.attributes["width"])
        end

        -- Use #box() wrapper for inline compatibility
        return pandoc.RawInline("typst", "#box(image(" .. table.concat(params, ", ") .. "))")
      end

      return image
    end,
    Div = function(div)
      -- is the div a .cell which contains .cell-output-display as child or grandchild?
      local cod = quarto.utils.match(".cell/:child/Div/:child/.cell-output-display")(div)
        or
        quarto.utils.match(".cell/:child/.cell-output-display")(div)
      if cod then
          div.classes:extend({'quarto-scaffold'})
          cod.classes:extend({'quarto-scaffold'})
      end
      return div
    end,
    Table = function(tbl)
      -- https://github.com/quarto-dev/quarto-cli/issues/10438
      tbl.classes:insert("typst:no-figure")
      return tbl
    end,
    Para = function(para)
      if #para.content ~= 1 then
        return nil
      end
      local img = quarto.utils.match("[1]/Image")(para)
      if not img then
        return nil
      end
      local align = img.attributes["fig-align"]
      if align == nil then
        return nil
      end

      img.attributes["fig-align"] = nil
      return pandoc.Plain({
        pandoc.RawInline("typst", "#align(" .. align .. ")["),
        img,
        pandoc.RawInline("typst", "]"),
      })
    end,
  }
end
