

-- resourceRefs.lua
-- Copyright (C) 2020 by RStudio, PBC


function resourceRefs() 
  
  return {
  
    Link = function(el)
      local ref = offsetRef(el.target)
      if ref then
        el.target = ref
      end
      recordFileResource(el.target)
      return el
    end,

    Image = function(el)
      local ref = offsetRef(el.src)
      if ref then
        el.src = ref
      end
      recordFileResource(el.src)
      return el
    end,

    RawInline = handleRawElement,
    RawBlock = handleRawElement,
  }
end

function handleRawElement(el)
  if isRawHtml(el) then
    local projOffset = projectOffset()
    el.text = handleHtmlRefs(el.text, projOffset, "a", "href")
    el.text = handleHtmlRefs(el.text, projOffset, "img", "src")
    el.text = handleHtmlRefs(el.text, projOffset, "link", "href")
    return el
  end
end

function offsetRef(ref)
  local projOffset = projectOffset()
  if projOffset ~= nil and string.find(ref, "^/") then
    return projOffset .. ref
  end
end

function projectOffset()
  local projOffset = param("project-offset")
  if projOffset ~= nil then
    return pandoc.utils.stringify(projOffset)
  else
    return nil
  end
end

function handleHtmlRefs(text, projOffset, tag, attrib)
  -- relative offset to project root if necessary
  if projOffset ~= nil then
    text = text:gsub("(<" .. tag .. " [^>]*)(" .. attrib .. "%s*=%s*\"/)", "%1" .. attrib .. "=\"" .. projOffset .. "/")
  end
  
  -- discover and record resource refs
  for ref in string.gmatch(text, "<" .. tag .. " [^>]*" .. attrib .. "%s*=%s*\"([^\"]+)\"") do
    recordFileResource(ref)
  end
  
  -- return potentially modified text
  return text
end

function recordFileResource(res)
  if res:find("^%a+://") == nil then
    preState.results.resourceFiles:insert(res)
  end
end


