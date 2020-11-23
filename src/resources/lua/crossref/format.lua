


function titlePrefix(type, default, num)
  local prefix = option(type .. "-title", stringToInlines(default))
  table.insert(prefix, pandoc.Space())
  tappend(prefix, numberOption(type, num))
  tappend(prefix, titleDelim())
  table.insert(prefix, pandoc.Space())
  return prefix
end

function titleDelim()
  return option("title-delim", stringToInlines(":"))
end


function captionSubfig()
  return option("caption-subfig", false)
end

function captionCollectedDelim()
  return option("caption-collected-delim", stringToInlines(",\u{a0}"))
end

function captionCollectedLabelSep()
  return option("caption-collected-label-sep", stringToInlines("\u{a0}—\u{a0}"))
end

function stringToInlines(str)
  return {pandoc.Str(str)}
end

function nbspString()
  return pandoc.Str '\u{a0}'
end

function subfigNumber(num)
  return numberOption("subfig", num,  {pandoc.Str("alpha"),pandoc.Space(),pandoc.Str("a")})
end

function refPrefix(type, default)
  local opt = type .. "-prefix"
  return option(opt, type .. ".")
end

function refDelim()
  return option("refDelm", ",")
end

function refHyperlink()
  return option("ref-hyperlink", true)
end


function numberOption(type, num, default)
  -- Compute option name and default value
  local opt = type .. "-labels"
  if default == nil then
    default = stringToInlines("arabic")
  end

  -- determine the style
  local styleRaw = option(opt, default)
  local numberStyle = pandoc.utils.stringify(styleRaw)

  -- process the style
  if (numberStyle == "arabic") then
    return {pandoc.Str(tostring(num))}
  elseif (string.match(numberStyle, "^alpha ")) then
    -- permits the user to include the character that they'd like
    -- to start the numbering with (e.g. alpha a vs. alpha A)
    local startIndexChar = string.sub(numberStyle, -1)
    if (startIndexChar == " ") then
      startIndexChar = "a"
    end
    local startIndex = utf8.codepoint(startIndexChar)
    return {pandoc.Str(string.char(startIndex + num - 1))}
  elseif (string.match(numberStyle, "^roman")) then
    -- permits the user to express `roman` or `roman lower` to
    -- use lower case roman numerals
    local lower = false
    if (string.sub(numberStyle, -#"i") == "i") then
      lower = true
    end
    return {pandoc.Str(toRoman(num, lower))}
  else
    -- otherwise treat the value as a list of values to use
    -- to display the numbers
    local entryCount = #styleRaw

    -- select an index based upon the num, wrapping it around
    local entryIndex = (num - 1) % entryCount + 1
    return styleRaw[entryIndex]
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
