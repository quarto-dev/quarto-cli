-- card.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


-- Card classes
local kCardClz = "card"
local kCardHeaderClz = "card-header"
local kCardBodyClz = "card-body"

-- Card classes that are forwarded to attributes
local kExpandable = "expandable"
local kCardClzToAttr = pandoc.List({kExpandable})

-- Card Attributes 
local kPadding = "padding"
local kHeight = "height"
local kMinHeight = "min-height"
local kMaxHeight = "max-height"
local kCardAttributes = pandoc.List({kPadding, kHeight, kMinHeight, kMaxHeight})

-- pop images out of paragraphs to the top level
-- this is necessary to ensure things like `object-fit`
-- will work with images (because they're directly contained)
-- in a constraining element
local function popImagePara(el)
  if el.t == "Para" and #el.content == 1 then
    return el.content
  else
    return _quarto.ast.walk(el, {
      Para = function(para)
        if #para.content == 1 then
          return para.content[1]
        end
        return para
      end
    })  
  end
end


local function readCardOptions(el) 
  local options = {}
  for _i, v in ipairs(kCardClzToAttr) do
    if el.classes:includes(v) then
      options[v] = true
    end
  end

  for _i, v in ipairs(kCardAttributes) do
    if el.attr.attributes[v] ~= nil then
      options[v] = el.attr.attributes[v]
    end
  end

  local clz = el.classes:filter(function(class)
    return not kCardClzToAttr:includes(class)
  end)

  return options, clz
end


-- title: string
-- contents: table
-- classes: table
-- Card DOM structure
-- .card[scrollable, max-height, min-height, full-screen(true, false), full-bleed?,]
--   .card-header
--   .card-body[max-height, min-height]
local function makeCard(title, contents, classes, options)  

  -- compute the card contents
  local cardContents = pandoc.List({})
  if title ~= nil and (pandoc.utils.type(title) ~= "table" or #title > 0) then
    local titleDiv = pandoc.Div(title.content, pandoc.Attr("", {kCardHeaderClz}))
    cardContents:insert(titleDiv)
  end

  -- pop paragraphs with only figures to the top
  local result = pandoc.List()
  for _i,v in ipairs(contents) do
    local popped = popImagePara(v);
    result:insert(popped)
  end
  
  local contentDiv = pandoc.Div(result, pandoc.Attr("", {kCardBodyClz}))
  cardContents:insert(contentDiv)

  -- add outer classes
  local clz = pandoc.List({kCardClz})
  if classes then
    clz:extend(classes)
  end

  local cardAttributes = pandoc.Attr("", clz)

  -- forward options onto attributes
  options = options or {}
  for k,v in pairs(options) do
    cardAttributes.attributes['data-' .. k] = v
  end
  return pandoc.Div(cardContents, cardAttributes)
end

return {
  makeCard = makeCard,
  readCardOptions = readCardOptions,
  classes = {
    card = kCardClz,
    body = kCardBodyClz,
    header = kCardHeaderClz
  }
}