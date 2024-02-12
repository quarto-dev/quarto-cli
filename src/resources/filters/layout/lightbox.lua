-- lightbox.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local lightbox_module = require("modules/lightbox")


-- attributes to forward from the image to the newly created link
local kDescription = "description"
local kForwardedAttr = {
  "title", kDescription, "desc-position", 
  "type", "effect", "zoomable", "draggable"
}

local kLightboxClass = "lightbox"
local kNoLightboxClass = "nolightbox"
local kGalleryPrefix = "quarto-lightbox-gallery-"

local function readAttrValue(el, attrName) 
  if attrName == kDescription then
    local doc = pandoc.read(el.attr.attributes[attrName])
    local attrInlines = doc.blocks[1].content
    return pandoc.write(pandoc.Pandoc(attrInlines), "html")
  else 
    return el[attrName]
  end
end


function lightbox() 
  -- whether we're automatically lightboxing
  local auto = false

  -- whether we need lightbox dependencies added
  local needsLightbox = false

  -- accumulate any description elements that we see to be emitted later in the document
  local descriptions = pandoc.List()

  -- a counter used to ensure each image is in its own gallery
  local imgCount = 0
  local function lightboxImage(imgEl, caption, gallery)
    -- note that we need to include the dependency for lightbox
    needsLightbox = true
    imgCount = imgCount + 1
  
    -- remove the class from the image
    imgEl.attr.classes = imgEl.attr.classes:filter(function(clz) 
      return clz ~= kLightboxClass
    end)
    
    -- attributes for the link
    local linkAttributes = {}
  
    -- mark this image as a lightbox target
    linkAttributes.class = kLightboxClass
  
    -- get the alt text from image and use that as title
    local title = caption
    if title == nil and imgEl.caption ~= nil and #imgEl.caption > 0 then
      title = pandoc.utils.stringify(imgEl.caption)
    elseif title ~= nil then
      title = pandoc.utils.stringify(title)
    end
  
    -- move a group attribute to the link, if present
    if imgEl.attr.attributes.group ~= nil then
      linkAttributes.gallery = imgEl.attr.attributes.group
      imgEl.attr.attributes.group = nil
    elseif gallery ~= nil then
      linkAttributes.gallery = gallery
    else 
      linkAttributes.gallery = kGalleryPrefix .. imgCount
    end
  
    -- write a description, if provided
    local descEl = nil
    local description = imgEl.attr.attributes[kDescription]
    imgEl.attr.attributes[kDescription] = nil
    if description ~= nil then
      local descId = "lightbox-desc-" .. imgCount
      descEl = pandoc.Div(pandoc.read(description).blocks, pandoc.Attr("", {"glightbox-desc", descId}))
      linkAttributes["data-glightbox"] = "description: ." .. descId .. ";"
      if title ~= nil then
        linkAttributes["data-glightbox"] = linkAttributes["data-glightbox"] .. "title:" .. title .. ";"
      end
   end
  
    -- forward any other known attributes
    for i, v in ipairs(kForwardedAttr) do
      if imgEl.attr.attributes[v] ~= nil then
        -- forward the attribute
        linkAttributes[v] = readAttrValue(imgEl, v)
      
        -- clear the attribute
        imgEl.attr.attributes[v] = nil
      end
  
      -- clear the title
      if (imgEl.title == 'fig:') then
        imgEl.title = ""
      end
  
    end
  
    -- wrap decorated images in a link with appropriate attrs
    local link = pandoc.Link({imgEl}, imgEl.src, title, linkAttributes)
    if descEl ~= nil then
      descriptions:insert(descEl)
    end
    return link
  end

  local function processImg(imgEl, options)
    local automatic = options.automatic
    local caption = options.caption
    local gallery = options.gallery

    if pandoc.utils.type(caption) == "Blocks" then
      caption = pandoc.utils.stringify(caption)
    end
  
    local autolightbox = automatic and auto and not imgEl.classes:includes(kNoLightboxClass)
    if autolightbox or imgEl.classes:includes('lightbox') then
      return lightboxImage(imgEl, caption, gallery)
    end
  end
  
  local function processFigure(figEl)
    local inMargin  = false
   local resolvedFigEl = _quarto.ast.walk(figEl, {
      Image = function(imgEl)
        inMargin = imgEl.classes:includes("column-margin")
        return processImg(imgEl, { automatic = true, caption = figEl.caption.long })
      end
    })
    if resolvedFigEl and inMargin then
      resolvedFigEl.attr.classes:insert("column-margin")
    end
    return resolvedFigEl;
  end

  local function processSubFloat(subFloatEl, gallery, parentFloat) 
    local subFloatModified = false
    subFloatEl = _quarto.ast.walk(subFloatEl, {
      traverse = 'topdown',
      Image = function(imgEl)
        local caption_content = subFloatEl.caption_long.content or subFloatEl.caption_long
        local caption = full_caption_prefix(parentFloat, subFloatEl)
        tappend(caption, caption_content)
        local subImgModified = processImg(imgEl, { automatic = true, caption = caption, gallery = gallery })
        if subImgModified ~= nil then
          subFloatModified = true
          return subImgModified, false
        else
          return nil, false
        end
      end
    })
    if subFloatModified then
      return subFloatEl
    else
      return nil
    end
  end

  if quarto.doc.is_format("html:js") then

    return {{
      traverse = "topdown",

      Meta = function(meta) 
        -- Set auto lightbox mode, if need be
        auto = lightbox_module.automatic(meta) == true
      end, 
      -- Find images that are already within links
      -- we'll use this to filter out these images if
      -- the most is auto
      Link = function()
        -- don't walk images, figures, etc... that are already within a link
        -- since we rely on being able to Link the image in order to 
        -- lightbox it
        return nil, false
      end,
      Div = function(div)
        -- Walk code cells and forward any lightbox parameters through to
        -- the image class that holds them
        if div.classes:includes("cell") and div.attributes["lightbox"] ~= nil then
          meta = quarto.json.decode(div.attributes["lightbox"])
          local codeImgCount = 0
          div = _quarto.ast.walk(div, {
            Image = function(imgEl)
              codeImgCount = codeImgCount + 1
              if (type(meta) == "table" and meta[kNoLightboxClass] == true) or meta == false then
                imgEl.classes:insert(kNoLightboxClass)
              else
                if not auto and ((type(meta) == "table" and not meta[kNoLightboxClass]) or meta == true) then
                  imgEl.classes:insert(kLightboxClass)
                end
                if (type(meta) == "table") then
                  if meta.group then
                    imgEl.attr.attributes.group = meta.group or imgEl.attr.attributes.group
                  end
                  for _, v in next, kForwardedAttr do
                    if type(meta[v]) == "table" and #meta[v] > 1 then 
                      -- if list attributes it should be one per plot
                      if codeImgCount > #meta[v] then
                        quarto.log.warning("More plots than '" .. v .. "' passed in YAML chunk options.")
                      else
                        attrLb = meta[v][codeImgCount]
                      end
                    else 
                      -- Otherwise reuse the single attributes
                      attrLb = meta[v]
                    end
                    imgEl.attr.attributes[v] = attrLb or imgEl.attr.attributes[v]
                  end
                end
              end
              return imgEl
            end
          })
          if div then
            div.attributes["lightbox"] = nil
          end
        end
        return div
      end,

      -- this catches images in paragraphs by themselves
      -- without captions, since Pandoc doesn't convert those to Figures
      Para = function(para)
        local image = discoverFigure(para, false)
        if image ~= nil then
          local lightboxedFigEl = processImg(image, { automatic = true })
          if lightboxedFigEl ~= nil then
            return pandoc.Para({lightboxedFigEl}), false
          end
        end
      end,

      -- This catches inline images
      Image = function(imgEl)
        -- look only for explicitly targeted images
        return processImg(imgEl, { automatic = false } ), false
      end,

      -- figures are "Block images" with captions: images in a para
      -- by themselves with a caption
      Figure = function(figEl)
        return processFigure(figEl), false
      end,

      -- these are ref targets
      FloatRefTarget = function(floatEl)

        if floatEl.parent_id == nil then
          local floatmodified = false
          floatEl = _quarto.ast.walk(floatEl, {
            traverse = 'topdown',
            Image = function(imgEl)
              local caption_content = floatEl.caption_long.content or floatEl.caption_long
              local caption = full_caption_prefix(floatEl)
              tappend(caption, caption_content)
              local modifiedImg = processImg(imgEl, { automatic = true, caption = caption })
              if modifiedImg ~= nil then
                floatmodified = true
              end
              return modifiedImg, false
            end,
            FloatRefTarget = function(subFloatEl)
              if subFloatEl.parent_id ~= nil then
                local subFloat = processSubFloat(subFloatEl, subFloatEl.parent_id, floatEl)
                if subFloat ~= nil then
                  floatmodified = true
                end              
                return subFloat, false  
              end
            end,
            Figure = function(figEl)
              local modifiedFig = processFigure(figEl)
              if modifiedFig ~= nil then 
                floatmodified = true
              end
              return modifiedFig, false
            end
          })

          if floatmodified then
            return floatEl, false
          else
            return nil, false
          end  
        end


      end,    
    },
    {
      Pandoc = function(doc)
        if #descriptions > 0 then
          local descContainer = pandoc.Div(descriptions, pandoc.Attr("", {"hidden"}, {["aria-hidden"]="true"}))
          doc.blocks:extend({descContainer})
          return doc
        end
      end,

      Meta = function(meta)
        -- If we discovered lightbox-able images
        -- we need to include the dependencies
        if needsLightbox then
          -- add the dependency
          quarto.doc.add_html_dependency({
            name = 'glightbox',
            scripts = {'../formats/html/glightbox/glightbox.min.js'},
            stylesheets = {'../formats/html/glightbox/glightbox.min.css', '../formats/html/glightbox/lightbox.css'}
          })

          -- read lightbox options
          local lbMeta = meta.lightbox
          local readEffect = function(el) 
            local val = pandoc.utils.stringify(el)
            if val == "fade" or val == "zoom" or val == "none" then
              return val
            else
              error("Invalid effect " + val)
            end
          end

          -- permitted options include:
          -- lightbox:
          --   effect: zoom | fade | none
          --   desc-position: top | bottom | left |right
          --   loop: true | false
          --   class: <class-name>
          local effect = "zoom"
          local descPosition = "bottom" 
          local loop = false
          local skin = nil
          
          -- The selector controls which elements are targeted.
          -- currently, it always targets .lightbox elements
          -- and there is no way for the user to change this
          local selector = "." .. kLightboxClass

          if lbMeta ~= nil and type(lbMeta) == 'table' then
            if lbMeta.effect ~= nil then
              effect = readEffect(lbMeta.effect)
            end

            if lbMeta['desc-position'] ~= nil then
              descPosition = pandoc.utils.stringify(lbMeta['desc-position'])
            end  

            if lbMeta['css-class'] ~= nil then
              skin = pandoc.utils.stringify(lbMeta['css-class'])
            end
            
            if lbMeta.loop ~= nil then
              loop = lbMeta.loop
            end
          end

          -- Generate the options to configure lightbox
          local options = {
            selector = selector,
            closeEffect = effect,
            openEffect = effect, 
            descPosition = descPosition,
            loop = loop,
          }
          if skin ~= nil then
            options.skin = skin
          end
          local optionsJson = quarto.json.encode(options)

          -- generate the initialization script with the correct options
          local scriptContents = "var lightboxQuarto = GLightbox(" .. optionsJson .. ");\n"
          scriptContents = scriptContents .. [[
window.onload = () => {
  lightboxQuarto.on('slide_before_load', (data) => {
    const { slideIndex, slideNode, slideConfig, player, trigger } = data;
    const href = trigger.getAttribute('href');
    if (href !== null) {
      const imgEl = window.document.querySelector(`a[href="${href}"] img`);
      if (imgEl !== null) {
        const srcAttr = imgEl.getAttribute("src");
        if (srcAttr && srcAttr.startsWith("data:")) {
          slideConfig.href = srcAttr;
        }
      }
    } 
  });

  lightboxQuarto.on('slide_after_load', (data) => {
    const { slideIndex, slideNode, slideConfig, player, trigger } = data;
    if (window.Quarto?.typesetMath) {
      window.Quarto.typesetMath(slideNode);
    }
  });

};
          ]]
          local scriptTag = "<script>" .. scriptContents .. "</script>"

          -- inject the rendering code
          quarto.doc.include_text("after-body", scriptTag)

        end
      end
    }}
  else
    return {}
  end   

end


