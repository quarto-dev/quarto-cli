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
