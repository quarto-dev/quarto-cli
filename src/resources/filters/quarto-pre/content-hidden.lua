-- content-hidden.lua
-- Copyright (C) 2022 by RStudio, PBC

function contentHidden()
  -- return {}
  return {
    Div = handleHiddenVisible,
    CodeBlock = handleHiddenVisible
  }
end

function handleHiddenVisible(el)
  if el.attr.classes:find("content-visible") then
    return handleVisible(el)
  elseif el.attr.classes:find("content-hidden") then
    return handleHidden(el)
  else
    return el
  end
end

function attributesMatch(el)
  local match = true
  if el.attributes["when-format"] ~= nil then
    match = match and quarto.doc.formatMatches(el.attributes["when-format"])
  end
  if el.attributes["unless-format"] ~= nil then
    match = match and not quarto.doc.formatMatches(el.attributes["unless-format"])
  end
  return match
end

function clearHiddenVisibleAttributes(el)
  el.attributes["unless-format"] = nil
  el.attributes["when-format"] = nil
  el.attr.classes = removeClass(el.attr.classes, "content-visible")
  el.attr.classes = removeClass(el.attr.classes, "content-hidden")
end

function handleVisible(el)
  local show = attributesMatch(el)
  clearHiddenVisibleAttributes(el)
  if not show then
    return pandoc.Null()
  end
  return el
end

function handleHidden(el)
  local hide = attributesMatch(el)
  clearHiddenVisibleAttributes(el)
  if hide then
    return pandoc.Null()
  end
  return el
end
