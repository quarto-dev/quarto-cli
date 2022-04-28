-- hidden.lua
-- Copyright (C) 2020 by RStudio, PBC

function hidden()
  return {
    Div = handleHiddenVisible,
    CodeBlock = handleHiddenVisible
  }
end

function handleHiddenVisible(el)
  if el.attr.classes:find("visible") then
    return handleVisible(el)
  elseif el.attr.classes:find("hidden") then
    return handleHidden(el)
  else
    return el
  end
end

output_table = {
  beamer = isBeamerOutput,
  docx = isDocxOutput,
  epub = isEpubOutput,
  html = isHtmlOutput,
  ["html-slide"] = isHtmlSlideOutput,
  ipynb = isIpynbOutput,
  latex = isLatexOutput,
  markdown = isMarkdownOutput,
  ["markdown-with-html"] = isMarkdownWithHtmlOutput,
  odt = isOdtOutput,
  pdf = isLatexOutput,
  powerpoint = isPowerPointOutput,
  revealjs = isRevealJsOutput,
  rtf = isRtfOutput,
  slide = isSlideOutput,
  ["word-processor"] = isWordProcessorOutput, 
}

function outputMatches(to)
  if output_table[to] == nil then
    return nil
  end
  return output_table[to](to)
end

function formatMatches(to)
  return (to == "pdf" and FORMAT == "latex") or to == FORMAT    
end

function attributesMatch(el)
  local match = true
  if el.attributes["when-format"] ~= nil then
    match = match and formatMatches(el.attributes["when-format"])
  end
  if el.attributes["unless-format"] ~= nil then
    match = match and not formatMatches(el.attributes["unless-format"])
  end
  if el.attributes["when-output"] ~= nil then
    match = match and outputMatches(el.attributes["when-output"])
  end
  if el.attributes["unless-output"] ~= nil then
    match = match and not outputMatches(el.attributes["unless-output"])
  end
  return match
end

function clearHiddenVisibleAttributes(el)
  el.attributes["unless-output"] = nil
  el.attributes["when-output"] = nil
  el.attributes["unless-format"] = nil
  el.attributes["when-format"] = nil
end

function handleVisible(el)
  local show = attributesMatch(el)
  clearHiddenVisibleAttributes(el)
  if show then
    el.attr.classes:remove(el.attr.classes:find("visible")[2])
    return el
  else
    return pandoc.Null()
  end
end

function handleHidden(el)
  local show = not attributesMatch(el)
  clearHiddenVisibleAttributes(el)
  if show then
    el.attr.classes:remove(el.attr.classes:find("hidden")[2])
    return el
  elseif isHtmlOutput() and param("keep-hidden", false) then
    return el
  else 
    return pandoc.Null()
  end
end
