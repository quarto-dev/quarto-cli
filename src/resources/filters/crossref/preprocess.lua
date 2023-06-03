-- preprocess.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- figures and tables support sub-references. mark them up before
-- we proceed with crawling for cross-refs
function crossref_preprocess()

  -- CONTINUE HERE, YOU ARE TRACKING THE NESTED FLOAT FIGURES
  -- TO PASS ALONG PARENTID TO THE SUBREFS, kRefParent etc.

  return {
    traverse = "topdown",
    FloatCrossref = function(float)
      float.content = _quarto.ast.walk(float.content, {
        FloatCrossref = function(subfloat)
          subfloat.parent_id = float.identifier
          return subfloat
        end
      })
      return float, false
    end
  }
  -- return {
  --   Pandoc = function(doc)      
  --     local walkRefs
  --     walkRefs = function(parentId)
  --       return {
  --         Div = function(el)
  --           if hasFigureOrTableRef(el) then
              
  --             -- provide error caption if there is none
  --             if not refCaptionFromDiv(el) then
  --               local err = pandoc.Para(noCaption())
  --               el.content:insert(err)
  --             end
              
  --             if parentId ~= nil then
  --               if refType(el.attr.identifier) == refType(parentId) then
  --                 el.attr.attributes[kRefParent] = parentId
  --               end
  --             else
  --               -- mark as table parent if required
  --               if isTableRef(el.attr.identifier) then
  --                 el.attr.classes:insert("tbl-parent")
  --                 flags.has_tbl_parent = true -- to be able to early-out later on
  --               end
  --               el = _quarto.ast.walk(el, walkRefs(el.attr.identifier))
  --             end
  --           end
  --           return el
  --         end,

  --         Table = function(el)
  --           return preprocessTable(el, parentId)
  --         end,
          
  --         RawBlock = function(el)
  --           return preprocessRawTableBlock(el, parentId)
  --         end,

  --         Para = function(el)
            
  --           -- provide error caption if there is none
  --           local fig = discoverFigure(el, false)
  --           if fig and hasFigureRef(fig) and #fig.caption == 0 then
  --             if isFigureRef(parentId) then
  --               fig.caption:insert(emptyCaption())
  --               fig.title = "fig:" .. fig.title
  --             else
  --               fig.caption:insert(noCaption())
  --             end
  --           end
            
  --           -- if we have a parent fig: then mark it's sub-refs
  --           if parentId and isFigureRef(parentId) then
  --             local image = discoverFigure(el)
  --             if image and isFigureImage(image) then
  --               image.attr.attributes[kRefParent] = parentId
  --             end
  --           end
            
  --           return el
  --         end
  --       }
  --     end

  --     -- walk all blocks in the document
  --     for i,el in pairs(doc.blocks) do
  --       -- always wrap referenced tables in a div
  --       if el.t == "Table" then
  --         doc.blocks[i] = preprocessTable(el, nil)
  --       elseif el.t == "RawBlock" then
  --         doc.blocks[i] = preprocessRawTableBlock(el, nil)
  --       elseif el.t ~= "Header" then
  --         local parentId = nil
  --         if hasFigureOrTableRef(el) and el.content ~= nil then
  --           parentId = el.attr.identifier

  --           -- mark as parent
  --           if isTableRef(el.attr.identifier) then
  --             el.attr.classes:insert("tbl-parent")
  --           end
            
  --           -- provide error caption if there is none
  --           if not refCaptionFromDiv(el) then
  --             local err = pandoc.Para(noCaption())
  --             el.content:insert(err)
  --           end
  --         end
  --         doc.blocks[i] = _quarto.ast.walk(el, walkRefs(parentId))
  --       end
  --     end

  --     return doc

  --   end
  -- }
end
