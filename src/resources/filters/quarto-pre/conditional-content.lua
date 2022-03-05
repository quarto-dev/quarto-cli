-- conditional-content.lua
--

local function matchAny(str, patternList)
    for _, pattern in ipairs(patternList) do
        local w = str:match(pattern)
        if w then return w end
    end
end

local webFormats = {'html','revealjs'}
local printFormats = {'latex','docx','pdf','opendocument','odt','beamer'}

function conditionalContent()
  return {

    -- discard the content of a div if the output format doesn't match
    Div = function(div)
      if div.classes:includes('web-only') and matchAny(FORMAT,  webFormats) or
        div.classes:includes('print-only') and matchAny(FORMAT, printFormats) then
          return div
      else
        return {}
      end
    end,

  }
end

