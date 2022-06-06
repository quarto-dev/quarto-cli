-- book.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoBook()
  return {
    CodeBlock = function(el)

      -- If this is a title block cell, we should render it
      -- using the template
      if (tcontains(el.attr.classes, 'quarto-title-block')) then

        -- read the contents of the code cell
        -- this should just be some metadata 
        local renderedDoc = pandoc.read(el.text, 'markdown')

        -- render the title block using the metdata and
        -- and the template
        local template = el.attr.attributes['template']

        -- process any author information
        local input = 'author'
        if renderedDoc.meta['authors'] then
          input = 'authors'
        end
        local processedMeta = processAuthorMeta(renderedDoc.meta, input)

        -- read the title block template
        local renderedBlocks = compileTemplate(template, processedMeta)

        return renderedBlocks
      end
    end
  }
end

