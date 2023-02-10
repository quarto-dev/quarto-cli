-- paths.lua
-- Copyright (C) 2022 Posit Software, PBC

function resourceRef(ref, dir)
  -- if the ref starts with / then just strip if off
  if string.find(ref, "^/") then
    -- check for protocol relative url
    if string.find(ref, "^//") == nil then
      return pandoc.text.sub(ref, 2, #ref)
    else
      return ref
    end
  -- if it's a relative ref then prepend the resource dir
  elseif isRelativeRef(ref) then
    if dir == '.' then
      return ref
    else
      return dir .. "/" .. ref
    end
  else
  -- otherwise just return it
    return ref
  end
end

function fixIncludePath(ref, dir)
  -- if it's a relative ref then prepend the resource dir
  if isRelativeRef(ref) then
    if dir ~= "." then
      return dir .. "/" .. ref
    else
      return ref
    end
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



function handlePaths(el, path, replacer)
  el.text = handleHtmlRefs(el.text, path, "img", "src", replacer)
  el.text = handleHtmlRefs(el.text, path, "img", "data-src", replacer)
  el.text = handleHtmlRefs(el.text, path, "link", "href", replacer)
  el.text = handleHtmlRefs(el.text, path, "script", "src", replacer)
  el.text = handleHtmlRefs(el.text, path, "source", "src", replacer)
  el.text = handleHtmlRefs(el.text, path, "embed", "src", replacer)
  el.text = handleCssRefs(el.text, path, "@import%s+", replacer)
  el.text = handleCssRefs(el.text, path, "url%(", replacer)
end


function handleHtmlRefs(text, resourceDir, tag, attrib, replacer)
  return text:gsub("(<" .. tag .. " [^>]*" .. attrib .. "%s*=%s*)\"([^\"]+)\"", function(preface, value)
    return preface .. "\"" .. replacer(value, resourceDir) .. "\""
  end)
end

function handleCssRefs(text, resourceDir, prefix, replacer)
  return text:gsub("(" .. prefix .. ")\"([^\"]+)\"", function(preface, value)
    return preface .. "\"" .. replacer(value, resourceDir) .. "\""
  end) 
end
