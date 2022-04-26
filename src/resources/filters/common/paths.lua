-- paths.lua
-- Copyright (C) 2022 by RStudio, PBC

function resourceRef(ref, dir)
  -- if the ref starts with / then just strip if off
  if string.find(ref, "^/") then
    return text.sub(ref, 2, #ref)
  -- if it's a relative ref then prepend the resource dir
  elseif isRelativeRef(ref) then
    return dir .. "/" .. ref
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

function handlePaths(el, path)
  el.text = handleHtmlRefs(el.text, path, "img", "src")
  el.text = handleHtmlRefs(el.text, path, "img", "data-src")
  el.text = handleHtmlRefs(el.text, path, "link", "href")
  el.text = handleHtmlRefs(el.text, path, "script", "src")
  el.text = handleHtmlRefs(el.text, path, "source", "src")
  el.text = handleHtmlRefs(el.text, path, "embed", "src")
  el.text = handleCssRefs(el.text, path, "@import%s+")
  el.text = handleCssRefs(el.text, path, "url%(")
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
