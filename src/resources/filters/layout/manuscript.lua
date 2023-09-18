-- manuscript.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local constants = require("modules/constants")
local kUnrollMarkdownCells = "unroll-markdown-cells"

function manuscriptUnroll() 
  local unrollMdCells = param(kUnrollMarkdownCells, false)

  -- JATS implements its own custom unrolling
  if unrollMdCells and not _quarto.format.isJatsOutput() then
    return {
      -- Process any cells that originated from notebooks
      Div = function(divEl)   
          -- If this is a markdown cell, we may need to unroll it
          if divEl.classes:includes("cell") and divEl.classes:includes("markdown") then
            return divEl.content
          end        
        end
      }
  else
    return {}
  end  
end

function manuscript() 

  if _quarto.format.isWordProcessorOutput() or _quarto.format.isLatexOutput() then

    local language = param("language", nil);
    local notebookPrefix = language[constants.kLangSourcePrefix]
    
    local manuscriptBaseUrl = param(constants.kManuscriptUrl)
    local notebookLinks = param(constants.kNotebookLinks)

    return {
      traverse = 'topdown',

      -- Process any cells that originated from notebooks
      Div = function(divEl)        

        -- Don't process these specially unless 'inline' links
        -- are enabled
        if (notebookLinks == false or notebookLinks == "global") then
          return
        end        

        -- we can't process links without a base url
        if not manuscriptBaseUrl then
          return
        end

        -- Read notebook parameters from the cell, if present
        local nbAbsPath = divEl.attributes[constants.kNotebook]
        local nbTitle = divEl.attributes[constants.kNotebookTitle]

        -- If this is a notebook embed cell, 'lift' the contents of any child divs
        -- up (unroll their contents), this will help us avoid
        -- labeling divs marked as `cells` more than once
        local blocks = pandoc.List()
        for _, childBlock in ipairs(divEl.content) do
          if childBlock.t == "Div" then
              tappend(blocks, childBlock.content)
          else
            blocks:insert(childBlock)
          end
        end
        divEl.content = blocks

        if nbAbsPath == nil then
          -- if this is a computational cell, synthesize the nbPath
          if divEl.classes:includes("cell") then
            -- See if this cell contains a div with explicit notebook info, if it does, we can safely ignore
            nbAbsPath = quarto.doc.input_file
            nbTitle = language['article-notebook-label']
          end
        end


        if nbAbsPath ~= nil then
          local nbRelPath = pandoc.path.make_relative(nbAbsPath, quarto.project.directory)
                      
          -- Use the notebook cotnext to try to determine the name
          -- of the output file
          local notebooks = param("notebook-context", {})
          local nbFileName = pandoc.path.filename(nbRelPath)
          local previewFile = nbFileName .. ".html"
          for _i, notebook in ipairs(notebooks) do      
            if notebook.source == nbAbsPath then
              if notebook['html-preview'] then
                previewFile = pandoc.path.filename(notebook['html-preview'].path)
              end
              break
            end
          end

          -- Provide preview path for the preview generator - this
          -- will specify a preview file name to use when generating this preview
          -- 
          -- NOTE: This is a point of coordinate where the name of the notebooks is important
          -- and this is relying upon that name being present in order to form these links
          --
          -- TODO: Make the filter params include notebook-context information that
          -- can be used to resolve links (if they are present)         
          local nbDir = pandoc.path.directory(nbRelPath)
          if nbDir == "." then
            nbDir = ""
          end
          local previewPath = pandoc.path.join({nbDir, previewFile})

          -- The title for the notebook
          if nbTitle == nil then
            nbTitle = nbFileName
          end

          -- The Id
          local cellId = divEl.attributes[constants.kNotebookCellId];
          if cellId ~= nil then
            cellId = '#' .. cellId
          else
            cellId = ''
          end
        

          -- The label link  
          local notebookUrl
          if manuscriptBaseUrl:sub(-1) ~= '/' then
            notebookUrl =  manuscriptBaseUrl .. '/' .. previewPath .. cellId;
          else
            notebookUrl =  manuscriptBaseUrl .. previewPath .. cellId;
          end

          local labelInlines = pandoc.List({ pandoc.Str(notebookPrefix), pandoc.Str(':'), pandoc.Space(), pandoc.Link(nbTitle, notebookUrl)})
          local did_resolve = false

          -- Attempt to forward the link into element captions, when possible
          local resolvedEl = _quarto.ast.walk(divEl, {
            FloatRefTarget = function(float)
              if float.caption then
                did_resolve = true
                labelInlines:insert(1, pandoc.Space())
                tappend(float.caption, labelInlines)
                return float
              end
            end,
          })
                    
          if did_resolve then
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