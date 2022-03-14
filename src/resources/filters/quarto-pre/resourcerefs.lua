-- resourceRefs.lua
-- Copyright (C) 2020 by RStudio, PBC

function resourceRefs() 
  return {
    Image = function(el)
      local file = currentFileMetadataState().file
      if file ~= nil then
        el.src = resourceRef(el.src, file.resourceDir)
      end
      return el
    end,

    RawInline = handleRawElement,
    RawBlock = handleRawElement,
  }
end

function handleRawElement(el)
  if isRawHtml(el) then
    local file = currentFileMetadataState().file
    if file ~= nil then
      el.text = handleHtmlRefs(el.text, file.resourceDir, "img", "src")
      el.text = handleHtmlRefs(el.text, file.resourceDir, "img", "data-src")
      el.text = handleHtmlRefs(el.text, file.resourceDir, "link", "href")
      el.text = handleHtmlRefs(el.text, file.resourceDir, "script", "src")
      el.text = handleHtmlRefs(el.text, file.resourceDir, "source", "src")
      el.text = handleHtmlRefs(el.text, file.resourceDir, "embed", "src")
      el.text = handleCssRefs(el.text, file.resourceDir, "@import%s+")
      el.text = handleCssRefs(el.text, file.resourceDir, "url%(")
      return el
    end
  end
end

function handleHtmlRefs(text, resourceDir, tag, attrib)
  return text:gsub("(<" .. tag .. " [^>]*" .. attrib .. "%s*=%s*)\"([^\"]+)\"", function(preface, value)
    return preface .. "\"" .. resourceRef(value, resourceDir) .. "\""
  end)
end

function handleCssRefs(text, resourceDir, prefix)
  return text:gsub("(" .. prefix .. ")\"([^\"]+)\"", function(preface, value)
    return preface .. "\"" .. resourceRef(value, resourceDir) .. "\""
  end) 
end

function resourceRef(ref, resourceDir)
  -- if the ref starts with / then just strip if off
  if string.find(ref, "^/") then
    return text.sub(ref, 2, #ref)
  -- if it's a relative ref then prepend the resource dir
  elseif isRelativeRef(ref) then
    return resourceDir .. "/" .. ref
  else
  -- otherwise just return it
    return ref
  end

end

function isRelativeRef(ref)
  return ref:find("^/") == nil and 
         ref:find("^%a+://") == nil and 
         ref:find("^data:") == nil and 
         ref:find("^#") == nil
end

