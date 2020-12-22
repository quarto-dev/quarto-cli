-- subrefs.lua
-- Copyright (C) 2020 by RStudio, PBC

-- figures and tables support sub-references. mark them up before
-- we proceed with crawling for cross-refs
function preprocess()
  
  return {
    Pandoc = function(doc)
      local walkRefs
      walkRefs = function(parentId)
        return {
          Div = function(el)
            if hasFigureOrTableRef(el) then
              
              -- provide error caption if there is none
              if not refCaptionFromDiv(el) then
                local err = pandoc.Para(noCaption())
                el.content:insert(err)
              end
              
              if parentId ~= nil then
                if refType(el.attr.identifier) == refType(parentId) then
                  el.attr.attributes[kRefParent] = parentId
                end
              else
                el = pandoc.walk_block(el, walkRefs(el.attr.identifier))
              end
            end
            return el
          end,

          Table = function(el)
            return preprocessTable(el, parentId)
          end,

          Para = function(el)
            
            -- provide error caption if there is none
            local fig = discoverFigure(el, false)
            if fig and hasFigureRef(fig) and #fig.caption == 0 then
              fig.caption:insert(noCaption())
            end
            
            -- if we have a parent fig: then mark it's sub-refs
            if parentId and isFigureRef(parentId) then
              local image = discoverFigure(el)
              if image and isFigureImage(image) then
                image.attr.attributes[kRefParent] = parentId
              end
            end
            
            return el
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do
      
        -- always wrap referenced tables in a div
        if el.t == "Table" then
          doc.blocks[i] = preprocessTable(el, nil)
        else
          local parentId = nil
          if hasFigureOrTableRef(el) then
            parentId = el.attr.identifier
          end
          doc.blocks[i] = pandoc.walk_block(el, walkRefs(parentId))
        end
      end
      
      return doc

    end
  }
end

function preprocessTable(el, parentId)
  
 -- if there is a caption then check it for a table suffix
  if el.caption.long ~= nil then
    local last = el.caption.long[#el.caption.long]
    if last and #last.content > 0 then
      local lastInline = last.content[#last.content]
      local label = refLabel("tbl", lastInline)
     
      if label then
        -- remove the id from the end
        last.content = tslice(last.content, 1, #last.content-1)
        
        -- provide error caption if there is none
        if #last.content == 0 then
          last.content:insert(noCaption())
        end
        
        -- wrap in a div with the label (so that we have a target
        -- for the tbl ref, in LaTeX that will be a hypertarget)
        local div = pandoc.Div(el, pandoc.Attr(label))
        
        -- propagate parent id if the parent is a table
        if parentId and isTableRef(parentId) then
          div.attr.attributes[kRefParent] = parentId
        end
        
        -- return the div
        return div
      end
    end
  end
  return el
end




