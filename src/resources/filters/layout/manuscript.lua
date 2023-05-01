-- manuscript.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local kNotebook = "notebook"
local kNotebookTitle = "notebook-title"


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

          local nbLabel = divEl.attributes[kNotebookTitle]
          if nbLabel == nil then
            nbLabel = pandoc.path.filename(nbPath)
          end

          -- TODO: Link to HTML view
          -- TODO: Link with cell identifier
          local labelInlines = pandoc.List({ pandoc.Str(notebookPrefix), pandoc.Str(':'), pandoc.Space(), pandoc.Link(nbLabel, repoUrl ..nbPath )})

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