
local mimeImgExts = {
  ["image/jpeg"]="jpg",
  ["image/gif"]="gif",
  ["image/vnd.microsoft.icon"]="ico",
  ["image/avif"]="avif",
  ["image/bmp"]="bmp",
  ["image/png"]="png",
  ["image/svg+xml"]="svg",
  ["image/tiff"]="tif",
  ["image/webp"]="webp",
}

local function file_exists(name)
  local f = io.open(name, 'r')
  if f ~= nil then
    io.close(f)
    return true
  else
    return false
  end
end

local function write_file(path, contents, mode)
  pandoc.system.make_directory(pandoc.path.directory(path), true)
  mode = mode or "a"
  local file = io.open(path, mode)
  if file then
    file:write(contents)
    file:close()
    return true
  else
    return false
  end
end




return {
  ['unsplash'] = function(args, kwargs, meta) 

    
    -- positional == keywords
    -- {{< unsplash cat >}}
    -- {{< unsplash keywords="cats" height="300" width="300"}}

    -- TODO: use the real api to download a copy of the image using rest
    -- TODO: ping the download url
    -- TODO: Generate a stable name for the image 
    -- TODO: Make this a format resource instead of media bag, so images become stable
    -- TODO: generate more complete information from REST endpoint to credit author

    local height = nil
    local width = nil
    local keywords = nil
    local classes = nil
    local float = nil
    
    -- the filename
    local filename
    if args[1] ~= nil then
      filename = pandoc.utils.stringify(args[1])
      local stem = pandoc.path.split_extension(pandoc.path.filename(filename))
      keywords = stem
    end

    -- height
    if kwargs['height'] ~= nil and #kwargs['height'] > 0 then
      height = pandoc.utils.stringify(kwargs['height'])
    end

    -- width
    if kwargs['width'] ~= nil and #kwargs['width'] > 0 then
      width = pandoc.utils.stringify(kwargs['width'])
    end

    -- keywords
    if kwargs['keywords'] ~= nil and #kwargs['keywords'] > 0 then
      keywords = pandoc.utils.stringify(kwargs['keywords'])
    end

    -- classes
    if kwargs['class'] ~= nil and #kwargs['class'] > 0 then
      classes = pandoc.utils.stringify(kwargs['class'])
    end

    -- classes
    if kwargs['float'] ~= nil and #kwargs['float'] > 0 then
      float = pandoc.utils.stringify(kwargs['float'])
    end


    -- form the unsplash URL that will be used
    local url = "https://source.unsplash.com/random"
    if width and height then
      url = url .. "/" .. tostring(width) .. '×' .. tostring(height)
    end
    if keywords ~= nil then
      url = url .. '/?' .. keywords
    end

    -- deal with the height and width

    local imgContainer = function (imgEl)

      -- HTML formats use a container to implement sizing, so
      -- apply classes and so on to that container
      if quarto.doc.is_format("html") then
      

        quarto.doc.add_html_dependency({
          name = "unsplash-styles",
          version = "1.0.0",
          stylesheets = {"style.css"}
        })

        local style = ""
        if height then 
          style = style .. 'height: ' .. height .. '; '
        end
        if width then 
          style = style .. 'width: ' .. width .. '; '
        end
        
        local divAttrRaw = {}      
        if style ~= "" then
          divAttrRaw['style'] = style
        end

        local clz = pandoc.List({'unsplash-container'})
        if float then
          clz:insert('float-' .. float)
        end

        if classes ~= nil then
          for token in string.gmatch(classes, "[^%s]+") do
            clz:insert(token)
          end
        end  

        local divAttr = pandoc.Attr("", clz, divAttrRaw)
        local div = pandoc.Div(imgEl, divAttr)
        
        return div 

      else

        -- Non-HTML formats just return the raw image with
        -- any options set on that

        if height then 
          imgEl.attr.attributes['height'] = height
        end
        if width then 
          imgEl.attr.attributes['width'] = width
        end

        if classes ~= nil then
          for clz in string.gmatch(classes, "[^%s]+") do
            imgEl.attr.classes:insert(clz)
          end
        end  

        return imgEl

      end
    end

    if filename ~= nil and file_exists(filename) then
      return imgContainer(pandoc.Image("", filename))
    elseif filename ~= nil then
      -- read the image
      local _imgMt, imgContents = pandoc.mediabag.fetch(url)
      write_file(filename, imgContents, "wb")
      return imgContainer(pandoc.Image("", filename))
    else
      -- read the image
      local imgMt, imgContents = pandoc.mediabag.fetch(url)

      -- place it in media bag and link to it
      if imgContents ~= nil then
        local tmpFileName = pandoc.path.filename(os.tmpname()) ..'.' .. mimeImgExts[imgMt]
        pandoc.mediabag.insert(tmpFileName, imgMt, imgContents)
        return imgContainer(pandoc.Image("", tmpFileName))
      end
    end


  end
}


