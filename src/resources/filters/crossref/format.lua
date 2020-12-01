-- format.lua
-- Copyright (C) 2020 by RStudio, PBC

function title(type, default)
  return option(type .. "-title", stringToInlines(default))
end

function titleString(type, default)
  return pandoc.utils.stringify(title(type, default))
end

function titlePrefix(type, default, order)
  local prefix = title(type, default)
  table.insert(prefix, pandoc.Space())
  tappend(prefix, numberOption(type, order))
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

function subfigNumber(order)
  return numberOption("subfig", order,  {pandoc.Str("alpha"),pandoc.Space(),pandoc.Str("a")})
end

function refPrefix(type, upper)
  local opt = type .. "-prefix"
  local prefix = option(opt, {pandoc.Str(type), pandoc.Str(".")})
  if upper then
    local el = pandoc.Plain:new(prefix)
    local firstStr = true
    el = pandoc.walk_block(el, {
      Str = function(str)
        if firstStr then
          local strText = text.upper(text.sub(str.text, 1, 1)) .. text.sub(str.text, 2, -1)
          str = pandoc.Str:new(strText)
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
  return option("ref-delim", stringToInlines(","))
end

function refHyperlink()
  return option("ref-hyperlink", true)
end

function numberOption(type, order, default)
  
  -- alias num
  local num = order.order
  
  -- return a pandoc.Str w/ chapter prefix (if any)
  function resolve(num)
    if option("chapters", false) then
      num = tostring(order.chapter) .. "." .. num
    end
    return { pandoc.Str(num) }
  end
  
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
    local option = styleRaw[entryIndex]
    if option("chapters", false) then
      tprepend(option, { pandoc.Str(tostring(order.chapter) .. ".") })
    end
    return option
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
