

-- ref parent attribute (e.g. fig:parent or tbl:parent)
kRefParent = "ref-parent"


-- does this element have a figure label?
function hasFigureRef(el)
  return isFigureRef(el.attr.identifier)
end

function isFigureRef(identifier)
  return string.find(identifier, "^fig:")
end

-- does this element have a table label?
function hasTableRef(el)
  return isTableRef(el.attr.identifier)
end

function isTableRef(identifier)
  string.find(identifier, "^tbl:")
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
  return el.attr.attributes[kRefParent] ~= nil
end

function refType(id)
  return string.match(id, "^(%a+)%:")
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
  return pandoc.Strong( { pandoc.Str("?Caption") })
end

   


