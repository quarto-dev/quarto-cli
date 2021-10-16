-- ipynb.lua
-- Copyright (C) 2021 by RStudio, PBC


function ipynb()
  if FORMAT == "ipynb" then
    return {

      Pandoc = function(doc)
        -- pandoc doesn't handle front matter title/author/date when creating ipynb
        -- so do that manually here. note that when we make authors more 
        -- sophisticated we'll need to update this code
        local title = readMetadataInlines(doc.meta, 'title')
        local author = readMetadataInlines(doc.meta, 'author')
        local date = readMetadataInlines(doc.meta, 'date')
        if title or author or date then
          local headerDiv = pandoc.Div({}, pandoc.Attr("", {"cell", "markdown"}))
          if title then
            local h1 = pandoc.Header(1, {})
            tappend(h1.content, title)
            headerDiv.content:insert(h1)
          end
          if author or date then
            local para = pandoc.Para({})
            if author then
              tappend(para.content, author)
              if date then
                para.content:insert(pandoc.LineBreak())
              end
            end
            if date then
              tappend(para.content, date)
            end
            headerDiv.content:insert(para)
          end
          dump(headerDiv)
          tprepend(doc.blocks, { headerDiv })
          return doc
        end
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
          { 'execute_result' }
        )
        return el
      end,
    
      CodeBlock = function(el)
        if (el.attr.classes.includes('cell-code')) then
          el.attr.classes = removeClass(el.attr.classes, 'cell-code')
        end
      end,

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

function removeClass(classes, remove)
  return classes:filter(function(clz) return clz ~= remove end)
end

function readMetadataInlines(meta, key)
  val = meta[key]
  if type(val) == "boolean" then
    return { pandoc.Str( tostring(val) ) }      
  elseif type(val) == "table" and val.t == "MetaInlines" then
    return val
  else
   return nil
  end
end