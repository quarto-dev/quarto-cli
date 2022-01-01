-- tables.lua
-- Copyright (C) 2021 by RStudio, PBC

function htmlTableCaptionPattern()
  return tagPattern("[Cc][Aa][Pp][Tt][Ii][Oo][Nn]")
end

function htmlTablePattern()
  return tagPattern("[Tt][Aa][Bb][Ll][Ee]")
end


function tagPattern(tag)
  local pattern = "(<" .. tag .. "[^>]*>)(.*)(</" .. tag .. ">)"
  return pattern
end

function anonymousTblId()
  return "tbl-anonymous-" .. tostring(math.random(10000000))
end

function isAnonymousTblId(identifier)
  return string.find(identifier, "^tbl%-anonymous-")
end

function isReferenceableTbl(tblEl)
  return tblEl.attr.identifier ~= "" and 
         not isAnonymousTblId(tblEl.attr.identifier)
end