


function titlePrefix(type, default, num)
  local prefix = option(type .. "-title", stringToInlines(default))
  table.insert(prefix, pandoc.Space())
  table.insert(prefix, pandoc.Str(numberOption(type, num)))
  tappend(prefix, titleDelim())
  table.insert(prefix, pandoc.Space())
  return prefix
end

function titleDelim()
  return option("title-delim", stringToInlines(":"))
end

function ccsDelim()
  return option("ccs-delim", stringToInlines(",\u{a0}"))
end

function ccsLabelSep()
  return option("ccs-label-sep", stringToInlines("\u{a0}—\u{a0}"))
end

function subfigCaptions()
  return option("subfig-captions", true)
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

function numberOption(type, num, default)
  -- Compute option name and default value
  local opt = type .. "-labels"
  if default == nil then
    default = stringToInlines("arabic")  
  end

  -- determine the style
  local numberStyle = pandoc.utils.stringify(option(opt, default))
  
  -- process the style
  if (numberStyle == "arabic") then 
    return tostring(num)    
  elseif (string.match(numberStyle, "^alpha ")) then
    -- permits the user to include the character that they'd like
    -- to start the numbering with (e.g. alpha a vs. alpha A)
    local startIndexChar = string.sub(numberStyle, -1)
    if (startIndexChar == " ") then
      startIndexChar = "a"
    end
    local startIndex = utf8.codepoint(startIndexChar)
    return string.char(startIndex + num - 1)
  elseif (string.match(numberStyle, "^roman")) then
    -- permits the user to express `roman` or `roman lower` to
    -- use lower case roman numerals
    local lower = false
    if (string.sub(numberStyle, -#"lower") == "lower") then
      lower = true
    end
    return toRoman(num, lower)    
  else
    return tostring(num)    
  end
end

-- from: https://gist.github.com/efrederickson/4080372
function toRoman(num, lower)

  local map = { 
      I = 1,
      V = 5,
      X = 10,
      L = 50,
      C = 100, 
      D = 500, 
      M = 1000,
  }
  local numbers = { 1, 5, 10, 50, 100, 500, 1000 }
  local chars = { "I", "V", "X", "L", "C", "D", "M" }
  if (lower) then
    chars = { "i", "v", "x", "l", "c", "d", "m" }
  end
  
  if num == math.huge then 
    error"Number too large to convert" 
  end
  
  num = math.floor(num)
  if num <= 0 then return num end
  
  local ret = ""
  for i = #numbers, 1, -1 do
    local number = numbers[i]
    while num - number >= 0 and num > 0 do
      ret = ret .. chars[i]
      num = num - number
    end
    for j = 1, i - 1 do
      local number2 = numbers[j]
      if num - (number - number2) >= 0 and num < num and num > 0 and number - number2 ~= number2 then
          ret = ret .. chars[j] .. chars[i]
          num = num - (number - number2)
          break
      end
    end
  end
return ret
end
