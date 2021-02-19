

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

    RawInline = handleHtmlRefs,
    RawBlock = handleHtmlRefs,
  
  }
 
end

function handleHtmlRefs(el)
  if isRawHtml(el) then
    local projOffset = projectOffset()
    if projOffset ~= nil then
      el.text = fixHtmlRefs(el.text, projOffset, "a", "href")
      el.text = fixHtmlRefs(el.text, projOffset, "img", "src")
      el.text = fixHtmlRefs(el.text, projOffset, "link", "href")
      return el
    end
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

function fixHtmlRefs(text, projOffset, tag, attrib)
  return text:gsub("(<" .. tag .. " [^>]*)(" .. attrib .. "%s*=%s*\"/)", "%1" .. attrib .. "=\"" .. projOffset .. "/")
end

function recordFileResource(res)
  if res:find("^%a+://") == nil then
    preState.results.resourceFiles:insert(res)
  end
end