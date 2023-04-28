-- book.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local authors = require 'modules/authors'
local license = require 'modules/license'

--- Removes notes and links
local function clean (inlines)
  -- this is in post, so it's after render, so we don't need to worry about
  -- custom ast nodes
  return inlines:walk {
    Note = function (_) return {} end,
    Link = function (link) return link.content end,
  }
end

--- Creates an Inlines singleton containing the raw LaTeX.
local function l(text)
  return pandoc.Inlines{pandoc.RawInline('latex', text)}
end

-- inject metadata
function quartoBook()
  return {
    Header = function(el) 
      if (quarto.doc.is_format("pdf") and param("single-file-book", false)) then
          -- Works around https://github.com/jgm/pandoc/issues/1632
          -- See https://github.com/quarto-dev/quarto-cli/issues/2412
          if el.level <= 2 and el.classes:includes 'unnumbered' then
            local title = clean(el.content)
            local secmark = el.level == 1
              and l'\\markboth{' .. title .. l'}{' .. title .. l'}'
              or l'\\markright{' .. title .. l'}' -- subsection, keep left mark unchanged
            return {el, secmark}
          end
      end
    end,
    CodeBlock = function(el)

      -- If this is a title block cell, we should render it
      -- using the template
      if el.attr.classes:includes('quarto-title-block') then

        -- read the contents of the code cell
        -- this should just be some metadata 
        local renderedDoc = pandoc.read(el.text, 'markdown')

        -- render the title block using the metdata and
        -- and the template
        local template = el.attr.attributes['template']

        -- process any author information
        local processedMeta = authors.processAuthorMeta(renderedDoc.meta)

        -- process license information for the book
        processedMeta = license.processLicenseMeta(processedMeta)

        -- read the title block template
        local renderedBlocks = compileTemplate(template, processedMeta)

        if #renderedBlocks ~= 0 then
          local emptyLine = pandoc.LineBreak()
          renderedBlocks:insert(emptyLine)
        end 

        return renderedBlocks
      end
    end
  }
end

