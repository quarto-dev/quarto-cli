-- ipynb.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local produceSourceNotebook = param('produce-source-notebook', false)


function render_ipynb_fixups()
  if not _quarto.format.isIpynbOutput() then 
    return {} 
  end

  return {
    Image = function(imgEl)

      -- remove image classes/attributes (as this causes Pandoc to write raw html, which in turn
      -- prevents correct handling of attachments in some environments including VS Code)

      -- If we are in source mode, we should produce a markdown image with all the additional attributes and data
      -- but we can't let Pandoc do that (or it will produce an HTML image), so we do this 
      -- little hack
      local imgAttr = imgEl.attr
      imgEl.attr = pandoc.Attr()

      -- the content that will be output
      local outputList = pandoc.List({imgEl})

      -- if we're producing a source notebook, try to preserve image attributes
      -- this is important for things like mermaid and graphviz
      if produceSourceNotebook and (imgAttr.identifier ~= "" or #imgAttr.classes > 0 or #imgAttr.attributes > 0) then
        -- process identifier
        local idStr = ''
        if imgAttr.identifier ~= "" then 
          idStr = '#' .. imgAttr.identifier 
        end

        -- process classes
        local clzStr = ''
        if imgAttr.classes and #imgAttr.classes > 0 then
          local clzTbl = {}
          for i, v in ipairs(imgAttr.classes) do
            clzTbl[i] = '.' .. v
          end
          clzStr = ' ' .. table.concat(clzTbl, ' ')
        end

        -- process atrributes
        local attrStr = ''
        if imgAttr.attributes then
          local attrTbl = {}
          for k, v in pairs(imgAttr.attributes) do
            table.insert(attrTbl, k .. '=' .. '"' .. v .. '"')
          end
          attrStr = ' ' .. table.concat(attrTbl, ' ')
        end

        -- return an markdown identifier directly adjacent to the image (tricking pandoc ;-) )
        outputList:insert(pandoc.RawInline("markdown", '{' .. idStr .. clzStr .. attrStr .. '}'))
      end

      return outputList

    end,
  }
end

function ipynb()
  if FORMAT == "ipynb" then
    return {
      {
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

          -- if we are in source notebook mode, we need to omit identifiers that appear on images
          -- and instead allow the cell yaml to declare things like ids
          if produceSourceNotebook and el.attr.classes:includes('cell-output-display') then

            -- First, we need to collapse tables that are surrounded by
            -- raw blocks (which specifically addresses tables that are parsed and 
            -- surrounded by rawblocks to contain unparseable content)
            -- This will catch GT tables and render HTML and markdown versions.
            if #el.content == 3 and el.content[1].t == "RawBlock" and el.content[2].t == "Table" and el.content[3].t == "RawBlock" then
              if el.content[1].format == "html" and el.content[3].format == "html" then

                local tbl = pandoc.Pandoc(el.content[2])
                local htmlRenderedTbl = pandoc.write(tbl, "html")
                local htmlRawBlock = pandoc.RawBlock("html", el.content[1].text .. htmlRenderedTbl .. el.content[3].text)

                local mdRenderedTbl = pandoc.write(tbl, "markdown")
                local mdRawBlock = pandoc.RawBlock("markdown", mdRenderedTbl)

                el.content = pandoc.Blocks({htmlRawBlock, mdRawBlock})
              end
            end

            el = _quarto.ast.walk(el, {
              Image = function(imgEl)
                imgEl.attr = pandoc.Attr()
                return imgEl
              end,
              Table = function(tbl)
                local rendered = pandoc.write(pandoc.Pandoc(tbl), "markdown")
                return pandoc.RawBlock("markdown", rendered)      
              end,      
            })
          elseif produceSourceNotebook then
            el = _quarto.ast.walk(el, {
              FloatRefTarget = function(float)
                float.in_code_cell_output = true
                return float
              end,
            })
          end

          el.attr.classes = fixupCellOutputClasses(
            el.attr.classes, 
            'cell-output-display', 
            { 'display_data' }
          )

          el.attr.classes = removeClass(el.attr.classes, 'cell-output')
          return el
        end,
      },
      {
        Pandoc = function(doc)

          -- pandoc doesn'tx handle front matter title/author/date when creating ipynb
          -- so do that manually here. note that when we make authors more 
          -- sophisticated we'll need to update this code

          -- read the title block template
          local titleBlockTemplate = param('ipynb-title-block')

          -- render the title block template
          local renderedBlocks = compileTemplate(titleBlockTemplate, doc.meta)

          -- prepend the blocks to the notebook
          tprepend(doc.blocks, renderedBlocks)

          return doc
          
        end,

        CodeBlock = function(el)
          if (el.attr.classes:includes('cell-code')) then
            el.attr.classes = removeClass(el.attr.classes, 'cell-code')
          end
          return el
        end,

        -- remove image classes/attributes (as this causes Pandoc to write raw html, which in turn
        -- prevents correct handling of attachments in some environments including VS Code)
        Image = function(el)
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