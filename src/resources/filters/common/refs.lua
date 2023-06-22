

-- ref parent attribute (e.g. fig:parent or tbl:parent)
kRefParent = "ref-parent"


-- does this element have a figure label?
function hasFigureRef(el)
  return isFigureRef(el.identifier)
end

function isFigureRef(identifier)
  if identifier == nil then
    return nil
  end
  
  local ref = refType(identifier)
  return crossref.categories.by_ref_type[ref] ~= nil
end

-- does this element have a table label?
function hasTableRef(el)
  return isTableRef(el.identifier)
end

function isTableRef(identifier)
  return (identifier ~= nil) and string.find(identifier, "^tbl%-")
end

-- does this element support sub-references
function hasFigureOrTableRef(el)
  return hasFigureRef(el) or hasTableRef(el)
end


function isRefParent(el)
  return el.t == "Div" and 
         (hasFigureRef(el) or hasTableRef(el)) and
         refCaptionFromDiv(el) ~= nil
end

function hasRefParent(el)
  return el.attributes[kRefParent] ~= nil
end

function refType(id)
  local match = string.match(id, "^(%a+)%-")
  if match then
    return pandoc.text.lower(match)
  else
    return nil
  end
end

function refCaptionFromDiv(el)
  local last = el.content[#el.content]
  if last and last.t == "Para" and #el.content > 1 then
    return last
  else
    return nil
  end
end

function noCaption()
  return pandoc.Strong( { pandoc.Str("?(caption)") })
end

function emptyCaption()
  return pandoc.Str("")
end

function hasSubRefs(divEl, type)
  if hasFigureOrTableRef(divEl) and not hasRefParent(divEl) then
    -- children w/ parent id
    local found = false
    local function checkForParent(el)
      if not found then
        if hasRefParent(el) then
          if not type or (refType(el.identifier) == type) then
            found = true
          end
        end

      end
    end
    _quarto.ast.walk(divEl, {
      Div = checkForParent,
      Image = checkForParent
    })
    return found
  else
    return false
  end
end
   


