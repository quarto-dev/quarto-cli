-- manuscript.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local kNotebook = "notebook"
local kNotebookTitle = "notebook-title"
local kNotebookCellId = "notebook-cellId"



function manuscript() 
  if _quarto.format.isWordProcessorOutput() or _quarto.format.isLatexOutput() then


    local language = param("language", nil);
    local notebookPrefix = language["source-notebooks-prefix"]

    local repoUrl = param('repo-url')
    return {

      -- Process any cells that originated from notebooks
      Div = function(divEl)        
        local nbPath = divEl.attributes[kNotebook]
        if repoUrl ~= nil and nbPath ~= nil then

          -- Provide preview path for the preview generator - this
          -- will specify a preview file name to use when generating this preview
          local nbFileName = pandoc.path.filename(nbPath)
          local nbDir = pandoc.path.directory(nbPath)
          local previewFile = nbFileName .. ".html"
          divEl.attributes['notebook-preview-file'] = previewFile;
          local previewPath = pandoc.path.join({nbDir, previewFile})

          -- The title for the notebook
          local nbTitle = divEl.attributes[kNotebookTitle]
          if nbTitle == nil then
            nbTitle = nbFileName
          end

          -- The Id
          local cellId = divEl.attributes[kNotebookCellId];
          if cellId ~= nil then
            cellId = '#' .. cellId
          else
            cellId = ''
          end

          -- TODO: Link with cell identifier
          local labelInlines = pandoc.List({ pandoc.Str(notebookPrefix), pandoc.Str(':'), pandoc.Space(), pandoc.Link(nbTitle, repoUrl .. previewPath .. cellId )})

          -- Attempt to forward the link into element captions, when possible
          local resolvedEl = _quarto.ast.walk(divEl, {
            Div = function(el)

              -- Forward to figure div
              if isFigureDiv(el) then
                local last = el.content[#el.content]
                if last and last.t == "Para" and #el.content > 1 then
                  labelInlines:insert(1, pandoc.Space())
                  tappend(last.content, labelInlines)  
                else
                  return nil
                end
                return el
              end
            end,
        
            -- Forward to figure image
            Para = function(el)
              local image = discoverFigure(el)
              if image and isFigureImage(image) then
                labelInlines:insert(1, pandoc.Space())
                tappend(image.caption, labelInlines)
                return el
              end
            end,

            -- Forward to tables
            Table = function(el)
              if el.caption then
                labelInlines:insert(1, pandoc.Space())
                tappend(el.caption, labelInlines)
                return el
              end
            end
          })
                    
          if resolvedEl then
            return resolvedEl
          else
            -- We couldn't forward to caption, just place inline
            divEl.content:insert(pandoc.Subscript(labelInlines))
            return divEl
          end
        end
      end
    }
  else 
    return {}
  end
end