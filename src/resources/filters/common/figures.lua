
-- filter which tags subfigures with their parent identifier. we do this
-- in a separate pass b/c normal filters go depth first so we can't actually
-- "see" our parent figure during filtering
function labelSubfigures()

  return {
    Pandoc = function(doc)
      local walkFigures
      walkFigures = function(parentId)
        return {
          Div = function(el)
            if isFigureDiv(el) then
              if parentId ~= nil then
                el.attr.attributes["figure-parent"] = parentId
              else
                el = pandoc.walk_block(el, walkFigures(el.attr.identifier))
              end
            end
            return el
          end,

          Para = function(el)
            if (parentId ~= nil) then
              local image = figureFromPara(el)
              if image and isFigureImage(image) then
                image.attr.attributes["figure-parent"] = parentId
              end
            end
            return el
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do
        local parentId = nil
        if isFigureDiv(el) then
          parentId = el.attr.identifier
        end
        doc.blocks[i] = pandoc.walk_block(el, walkFigures(parentId))
      end
      return doc

    end
  }
end

function collectSubfigures(divEl)
  if isFigureDiv(divEl) then
    local subfigures = pandoc.List:new()
    pandoc.walk_block(divEl, {
      Div = function(el)
        if isSubfigure(el) then
          subfigures:insert(el)
          el.attr.attributes["figure-parent"] = nil
        end
      end,
      Para = function(el)
        local image = figureFromPara(el)
        if image and isSubfigure(image) then
          subfigures:insert(image)
          image.attr.attributes["figure-parent"] = nil
        end
      end,
      HorizontalRule = function(el)
        subfigures:insert(el)
      end
    })
    if #subfigures > 0 then
      return subfigures
    else
      return nil
    end
  else
    return nil
  end
end


function isSubfigure(el)
  if el.attr.attributes["figure-parent"] then
    return true
  else
    return false
  end
end


-- is this a Div containing a figure
function isFigureDiv(el)
  return el.t == "Div" and hasFigureLabel(el) and (figureDivCaption(el) ~= nil)
end

-- is this an image containing a figure
function isFigureImage(el)
  return hasFigureLabel(el) and #el.caption > 0
end

-- does this element have a figure label?
function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
end

function figureDivCaption(el)
  local last = el.content[#el.content]
  if last and last.t == "Para" and #el.content > 1 then
    return last
  else
    return nil
  end
end

function figureFromPara(el)
  if #el.content == 1 and el.content[1].t == "Image" then
    local image = el.content[1]
    if #image.caption > 0 then
      return image
    else
      return nil
    end
  else
    return nil
  end
end
