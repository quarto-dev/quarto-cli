-- html.lua
-- Copyright (C) 2021 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- make images responsive (unless they have an explicit height attribute)
Image = function(image)
  if not image.attr.attributes["height"] then
    image.attr.classes:insert("img-fluid")
    return image
  end
end

-- tabsets and notices
Div = function(div)
  if div.attr.classes:find("admonition") then
    return noticeDiv(div)
  elseif div.attr.classes:find("tabset") then
    return tabsetDiv(div)
  end  
end


function noticeDiv(div)
  -- capture type information
  local type = div.attr.attributes["type"] 
  if type == nil then
    type = "info"
  end

  -- capture caption information
  local caption = div.attr.attributes["caption"]
  div.attr.attributes["caption"] = nil

  -- Make an outer card div and transfer classes
  local cardDiv = pandoc.Div({})
  cardDiv.attr.classes = div.attr.classes:clone()
  div.attr.classes = pandoc.List:new() 

  -- add card attributes
  cardDiv.attr.classes:insert("card")
  
  -- create a card header
  if caption ~= nil then
    local cardHeaderDiv = pandoc.Div({})
    cardHeaderDiv.attr.classes:insert("card-header")
    cardHeaderDiv.content:insert(pandoc.Plain(type))
    cardDiv.content:insert(cardHeaderDiv)
  end

  -- create a card body
  div.attr.classes:insert("card-body")
  cardDiv.content:insert(div)
  
  return cardDiv
end


function tabsetDiv(div)
  print('tabset')
  return div
end