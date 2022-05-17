-- ipynb.lua
-- Copyright (C) 2021 by RStudio, PBC


function ipynb()
  if FORMAT == "ipynb" then
    return {

      Pandoc = function(doc)


        -- pandoc doesn'tx handle front matter title/author/date when creating ipynb
        -- so do that manually here. note that when we make authors more 
        -- sophisticated we'll need to update this code


        -- read the title block template
        local titleBlockTemplate = param('ipynb-title-block')
        local f = io.open(pandoc.utils.stringify(titleBlockTemplate), "r")
        local contents = f:read("*all")
        f:close()

        -- compile the title block template
        local compiledTemplate = pandoc.template.compile(contents)
        local template_opts = pandoc.WriterOptions {template = compiledTemplate}  

        -- render the current document and read it to generate an AST for the
        -- title block
        local metaDoc = pandoc.Pandoc(pandoc.Blocks({}), doc.meta)
        local rendered = pandoc.write(metaDoc, 'gfm', template_opts)
        local titleDoc = pandoc.read(rendered, 'gfm')

        -- prepend the blocks to the notebook
        tprepend(doc.blocks, titleDoc.blocks )

        return doc
        
      end,

      Div = function(el)
        if el.attr.classes:includes('cell') then
          el.attr.classes:insert('code')
        end
        el.attr.classes = fixupCellOutputClasses(
          el.attr.classes, 
          'cell-output-stdout', 
          { 'stream', 'stdout' }
        )
        el.attr.classes = fixupCellOutputClasses(
          el.attr.classes, 
          'cell-output-stderr', 
          { 'stream', 'stderr' }
        )
        el.attr.classes = fixupCellOutputClasses(
          el.attr.classes, 
          'cell-output-display', 
          { 'display_data' }
        )
        el.attr.classes = removeClass(el.attr.classes, 'cell-output')
        return el
      end,
    
      CodeBlock = function(el)
        if (el.attr.classes:includes('cell-code')) then
          el.attr.classes = removeClass(el.attr.classes, 'cell-code')
        end
      end,

      -- note that this also catches raw blocks inside display_data 
      -- but pandoc seems to ignore the .cell .raw envelope in this
      -- case and correctly produce text/html cell output
      RawBlock = function(el)
        local rawDiv = pandoc.Div(
          { el }, 
          pandoc.Attr("", { "cell", "raw" })
        )
        return rawDiv
      end
    }
  else
    return {}
  end
end

function fixupCellOutputClasses(classes, cellOutputClass, outputClasses)
  if classes:includes(cellOutputClass) then
    classes = removeClass(classes, cellOutputClass)
    classes:insert("output")
    tappend(classes, outputClasses)
  end
  return classes
end

function readMetadataInlines(meta, key)
  val = meta[key]
  if type(val) == "boolean" then
    return { pandoc.Str( tostring(val) ) } 
  elseif type(val) == "string" then
    return stringToInlines(val)     
  elseif pandoc.utils.type(val) == "Inlines" then
    return val
  else
   return nil
  end
end