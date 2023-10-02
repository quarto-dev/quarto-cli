-- format.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function title(type, default)
  default = param("crossref-" .. type .. "-title", default)
  return crossrefOption(type .. "-title", stringToInlines(default))
end

function envTitle(type, default)
  return param("environment-" .. type .. "-title", default)
end

function titleString(type, default)
  return pandoc.utils.stringify(title(type, default))
end

function titlePrefix(type, default, order, with_delimiter)
  if with_delimiter == nil then
    with_delimiter = true
  end

  local prefix = title(type, default)
  table.insert(prefix, nbspString())
  tappend(prefix, numberOption(type, order))
  if with_delimiter then
    tappend(prefix, titleDelim())
    table.insert(prefix, pandoc.Space())
  end
  return prefix
end

function titleDelim()
  return crossrefOption("title-delim", stringToInlines(":"))
end

function captionSubfig()
  return crossrefOption("caption-subfig", true)
end

function captionCollectedDelim()
  return crossrefOption("caption-collected-delim", stringToInlines(",\u{a0}"))
end

function captionCollectedLabelSep()
  return crossrefOption("caption-collected-label-sep", stringToInlines("\u{a0}—\u{a0}"))
end

function subrefNumber(order)
  return numberOption("subref", order,  {pandoc.Str("alpha"),pandoc.Space(),pandoc.Str("a")})
end

function prependSubrefNumber(captionContent, order)
  if not _quarto.format.isLatexOutput() and not _quarto.format.isAsciiDocOutput() then
    if #inlinesToString(captionContent) > 0 then
      tprepend(captionContent, { pandoc.Space() })
    end
    tprepend(captionContent, { pandoc.Str(")") })
    tprepend(captionContent, subrefNumber(order))
    captionContent:insert(1, pandoc.Str("("))
  end
end

function refPrefix(type, upper)
  local opt = type .. "-prefix"
  local default = param("crossref-" .. type .. "-prefix")
  if default == nil then
    default = crossref.categories.by_ref_type[type]
    if default ~= nil then
      default = default.prefix
    end
  end
  if default == nil then
    default = type .. "."
  end
  default = stringToInlines(default)
  local prefix = crossrefOption(opt, default)
  if upper then
    local el = pandoc.Plain(prefix)
    local firstStr = true
    el = _quarto.ast.walk(el, {
      Str = function(str)
        if firstStr then
          local strText = pandoc.text.upper(pandoc.text.sub(str.text, 1, 1)) .. pandoc.text.sub(str.text, 2, -1)
          str = pandoc.Str(strText)
          firstStr = false
        end
        return str
      end
    })
    prefix = el.content
  end
  return prefix
end

function refDelim()
  return crossrefOption("ref-delim", stringToInlines(","))
end

function refHyperlink()
  return crossrefOption("ref-hyperlink", true)
end

function refNumberOption(type, entry)

  -- for sections just return the section levels
  if type == "sec" then
    local num = nil
    if entry.appendix then
      num = string.char(64 + entry.order.section[1] - crossref.startAppendix + 1)
    elseif crossrefOption("chapters", false) then
      num = tostring(entry.order.section[1])
    end
    return stringToInlines(sectionNumber(entry.order.section, nil, num))
  end

  -- handle other ref types
  return formatNumberOption(type, entry.order)
end


function numberOption(type, order, default)
  
  -- for sections, just return the section levels (we don't currently
  -- support custom numbering for sections since pandoc is often the
  -- one doing the numbering)
  if type == "sec" then
    return stringToInlines(sectionNumber(order.section))
  end

  -- format
  return formatNumberOption(type, order, default)
end

function formatNumberOption(type, order, default)

  -- alias num and section (set section to nil if we aren't using chapters)
  local num = order.order
  local section = order.section
  if not crossrefOption("chapters", false) then
    section = nil
  elseif section ~= nil and section[1] == 0 then
    section = nil
  elseif crossref.maxHeading ~= 1 then
    section = nil
  end
  
  -- return a pandoc.Str w/ chapter prefix (if any)
  local function resolve(num)
    if section then
      local sectionIndex = section[1]
      if crossrefOption("chapters-alpha", false) then
        sectionIndex = string.char(64 + sectionIndex)
      elseif crossref.startAppendix ~= nil and sectionIndex >= crossref.startAppendix then
        sectionIndex = string.char(64 + sectionIndex - crossref.startAppendix + 1)
      else
        sectionIndex = tostring(sectionIndex)
      end
      num = sectionIndex .. "." .. num
    end
    return pandoc.Inlines({ pandoc.Str(num) })
  end
  
  -- Compute option name and default value
  local opt = type .. "-labels"
  if default == nil then
    default = stringToInlines("arabic")
  end

  -- See if there a global label option, if so, use that
  -- if the type specific label isn't specified
  local labelOpt = crossrefOption("labels", default);
  
  -- determine the style
  local styleRaw = crossrefOption(opt, labelOpt)


  local numberStyle = pandoc.utils.stringify(styleRaw)

  -- process the style
  if (numberStyle == "arabic") then
    return resolve(tostring(num))
  elseif (string.match(numberStyle, "^alpha ")) then
    -- permits the user to include the character that they'd like
    -- to start the numbering with (e.g. alpha a vs. alpha A)
    local startIndexChar = string.sub(numberStyle, -1)
    if (startIndexChar == " ") then
      startIndexChar = "a"
    end
    local startIndex = utf8.codepoint(startIndexChar)
    return resolve(string.char(startIndex + num - 1))
  elseif (string.match(numberStyle, "^roman")) then
    -- permits the user to express `roman` or `roman i` or `roman I` to
    -- use lower / uppper case roman numerals
    local lower = false
    if (string.sub(numberStyle, -#"i") == "i") then
      lower = true
    end
    return resolve(toRoman(num, lower))
  else
    -- otherwise treat the value as a list of values to use
    -- to display the numbers
    local entryCount = #styleRaw

    -- select an index based upon the num, wrapping it around
    local entryIndex = (num - 1) % entryCount + 1
    local option = styleRaw[entryIndex]:clone()
    if section then
      tprepend(option, { pandoc.Str(tostring(section[1]) .. ".") })
    end
    return pandoc.Inlines({ option })
  end

end


function sectionNumber(section, maxLevel, num)

  if num == nil then
    num = ""
    if crossref.maxHeading == 1 then
      num = formatChapterIndex(section[1])
    end
  end

  local endIndex = #section
  if maxLevel then
    endIndex = maxLevel
  end
  local lastIndex = 1
  for i=endIndex,2,-1 do
    if section[i] > 0 then
      lastIndex = i
      break
    end
  end

  for i=2,lastIndex do
    if num ~= '' then
      num = num .. "."
    end
    num = num .. tostring(section[i])
  end

  return num
end

function isChapterRef(section)
  for i=2,#section do
    if section[i] > 0 then
      return false
    end
  end
  return true
end

function formatChapterIndex(index)
  local fileMetadata = currentFileMetadataState()
  if fileMetadata.appendix then
    return string.char(64 + fileMetadata.file.bookItemNumber)
  elseif crossrefOption("chapters-alpha", false) then
    return string.char(64 + index)
  else
    return tostring(index)
  end
end

function toRoman(num, lower)
  local roman = pandoc.utils.to_roman_numeral(num)
  if lower then
    lower = ''
    for i = 1, #roman do
      lower = lower .. string.char(utf8.codepoint(string.sub(roman,i,i)) + 32)
    end
    return lower
  else
    return roman
  end
end
