
-- slice elements out of a table
-- TODO: Move to _quarto.utils.table.slice
local function tslice(t, first, last, step)
  local sliced = {}
  for i = first or 1, last or #t, step or 1 do
    sliced[#sliced+1] = t[i]
  end
  return sliced
end


local function makeCard(title, contents, classes)  
  
  -- compute the card contents
  local cardContents = pandoc.List({})
  if title ~= nil then
    local titleDiv = pandoc.Div(title.content, pandoc.Attr("", {"card-header"}))
    cardContents:insert(titleDiv)
  end
  local contentDiv = pandoc.Div(contents, pandoc.Attr("", {"card-body"}))
  cardContents:insert(contentDiv)


  -- add outer classes
  local clz = pandoc.List({"card"})
  if classes then
    clz:extend(classes)
  end

  return pandoc.Div(cardContents, pandoc.Attr("", clz))
end

local function makeValueBox(title, value, icon, content) 
  if value == nil then
    error("Value boxes must have a value")
  end
  local vbDiv = pandoc.Div({}, pandoc.Attr("value-box-grid", {}))

  -- The valuebox icon
  if icon ~= nil then
    local vbShowcase = pandoc.Div({pandoc.RawInline("html", '<i class="bi bi-' .. icon .. '"></i>')}, pandoc.Attr("value-box-showcase", {}))
    vbDiv.content:insert(vbShowcase)
  end

  -- value-box-area
    -- title
    -- value
    -- other stuff

  local vbArea = pandoc.Div({}, pandoc.Attr("", {"value-box-area"}))
  vbDiv.content:insert(vbArea)

  -- The valuebox title
  local vbTitle = pandoc.Div(title, pandoc.Attr("", {"value-box-title"}))
  vbArea.content:insert(vbTitle)

  -- The valuebox value
  local vbValue = pandoc.Div(value, pandoc.Attr("", {"value-box-value"}))
  vbArea.content:insert(vbValue)

  -- The rest of the contents
  if content ~= nil then
    tappend(vbDiv.content, content)
  end

  return makeCard(nil, vbDiv)
end


function render_dashboard() 

  -- only do this for dashboad output
  if not _quarto.format.isDashboardOutput() then
    return {}
  end
  return {
    {
      Pandoc = function(el)
        -- Make sections based upon the headings and use that for the 
        -- document structure
        local opts = PANDOC_WRITER_OPTIONS
        local result =  pandoc.structure.make_sections(el.blocks, opts)
        return pandoc.Pandoc(result, el.meta)
      end
    },
    {
      Div = function(el) 

        if el.classes:includes('card') then
          quarto.log.output("CARD")

          -- see if the card is already in the correct structure (a single header and body)
          -- exit early, not processing if it is already processed in this way
          local cardHeader = el.content[1]
          local cardBody = el.content[2]
          local hasHeader = cardHeader ~= nil and cardHeader.classes ~= nil and cardHeader.classes:includes('card-header')
          local hasBody = cardBody ~= nil and cardBody.classes ~= nil and cardBody.classes:includes('card-body')
          if hasHeader and hasBody then
            return nil
          end

          -- Support explicit cards as divs (without the proper nested structure)
          -- First element as a header will be used as the title, if present
          -- otherwise just use the contents as the card body
          local header = el.content[1]
          local title = {}
          local contents = el.content
          if header.t == "Header" then
            title = header
            contents = tslice(el.content, 2)
          end
          return makeCard(title, contents)        
        elseif el.classes:includes('valuebox') then

          quarto.log.output("VALUEBOX")

          local header = el.content[1]
          local title = {}
          local value = el.content
          local content = {}
          local icon = el.attributes['icon']
          if header.t == "Header" then
            title = header.content
            value = tslice(el.content, 2)
          end
          


          if #value > 1 then
            content = tslice(value, 2)
            value = value[1]
          end
          quarto.log.output(value)

          return makeValueBox(title, value, icon, content)
        
        elseif el.classes:includes('section') then
          quarto.log.output("SECTION")
          -- Allow sections to be 'cards'
          local header = el.content[1]
          if header.t == "Header" then            
            local contents = tslice(el.content, 2)
            return makeCard(header, contents)
          end
        end
      end,
    }
  }
end