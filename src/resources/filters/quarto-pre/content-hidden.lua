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

-- we have some special rules to allow formats to behave more intuitively
function formatMatches(to)
  if FORMAT == to then
    return true
  else
    -- latex and pdf are synonyms
    if to == "latex" or to == "pdf" then
      return isLatexOutput()
    -- odt and opendocument are synonyms
    elseif to == "odt" or to == "opendocument" then
      return isOdtOutput()
    -- epub: epub, epub2, or epub3
    elseif to:match 'epub' then 
      return isEpubOutput()
    -- html: html, html4, html4, epub*, or slides (e.g. revealjs)
    elseif to == "html" then
      return isHtmlOutput()
    -- markdown: markdown*, commonmark*, gfm, markua
    elseif to == "markdown" then
      return isMarkdownOutput()
    else
      return false
    end 
  end
end

function attributesMatch(el)
  local match = true
  if el.attributes["when-format"] ~= nil then
    match = match and formatMatches(el.attributes["when-format"])
  end
  if el.attributes["unless-format"] ~= nil then
    match = match and not formatMatches(el.attributes["unless-format"])
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
