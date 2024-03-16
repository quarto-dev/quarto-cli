-- lightbox.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


local function lightbox_auto(meta) 
  -- If the mode is auto, we need go ahead and 
  -- run if there are any images (ideally we would)
  -- filter to images in the body, but that can be
  -- left for future me to deal with 
  -- supports:
  -- lightbox: true
  -- lightbox: auto
  -- or
  -- lightbox:
  --   match: auto
  local lbMeta = meta.lightbox
  if lbMeta ~= nil and type(lbMeta) == 'table' then
    if lbMeta[1] ~= nil then
      if lbMeta[1]['text'] == "auto" then
        return true
      end
    elseif lbMeta.match ~= nil and pandoc.utils.stringify(lbMeta.match) == 'auto' then
      return true
    end
  elseif lbMeta == true then
    return true
  elseif lbMeta == false then
    return false
  end
  -- return nil so caller can know the difference between 
  -- explicitly off and omitted
  return nil
end

local function el_has_lightbox(el)
  
  local has_lightbox = el.attributes["lightbox"] ~= nil or el.classes:includes('lightbox')
  return has_lightbox
end

return {
  automatic = lightbox_auto,
  el_has_lightbox = el_has_lightbox
}


