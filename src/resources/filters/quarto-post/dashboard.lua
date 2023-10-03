
-- slice elements out of a table
-- TODO: Move to _quarto.utils.table.slice
local function tslice(t, first, last, step)
  local sliced = {}
  for i = first or 1, last or #t, step or 1 do
    sliced[#sliced+1] = t[i]
  end
  return sliced
end

local function popImagePara(el)

  return _quarto.ast.walk(el, {
    Para = function(para)
      if #para.content == 1 then
        return para.content[1]
      end
      return para
    end
  })

end

local function makeRows(content)
  return pandoc.Div(content, pandoc.Attr("", {"rows"}))
end

local function makeCols(content) 
  return pandoc.Div(content, pandoc.Attr("", {"columns"}))
end

local function dashboardParam(name, default) 
  local dashboard = param("dashboard", {})
  return dashboard[name] or default
end

-- title: string
-- contents: table
-- classes: table
local function makeCard(title, contents, classes)  
  -- Card DOM structure
  -- .card[scrollable, max-height, min-height, full-screen(true, false), full-bleed?,]
  --   .card-header
  --   .card-body[max-height, min-height]

  -- compute the card contents
  local cardContents = pandoc.List({})
  if title ~= nil then
    local titleDiv = pandoc.Div(title.content, pandoc.Attr("", {"card-header"}))
    cardContents:insert(titleDiv)
  end

  -- pop paragraphs with only figures to the top
  -- cell-output-display
  -- or root level paras
  local result = pandoc.List()
  for i,v in ipairs(contents) do
    local popped = popImagePara(v);
    result:insert(popped)
  end
  
  local contentDiv = pandoc.Div(result, pandoc.Attr("", {"card-body"}))
  cardContents:insert(contentDiv)


  -- add outer classes
  local clz = pandoc.List({"card"})
  if classes then
    clz:extend(classes)
  end

  return pandoc.Div(cardContents, pandoc.Attr("", clz))
end

local function makeValueBox(title, value, icon, content, classes) 
  if value == nil then
    error("Value boxes must have a value")
  end

  -- ValueBox DOM structure
  -- .card .value-box[showcase(left-center,top-right,bottom), color(scss name, actual value)]
  --   .value-box-grid
  --     .value-box-showcase
  --     .value-box-area
  --       .value-box-title
  --       .value-box-value
  --        other content

  local vbDiv = pandoc.Div({}, pandoc.Attr("", {"value-box-grid"}))

  -- The valuebox icon
  if icon ~= nil then
    local vbShowcase = pandoc.Div({pandoc.RawInline("html", '<i class="bi bi-' .. icon .. '"></i>')}, pandoc.Attr("", {"value-box-showcase"}))
    vbDiv.content:insert(vbShowcase)
  end

  local vbArea = pandoc.Div({}, pandoc.Attr("", {"value-box-area"}))
  

  -- The valuebox title
  local vbTitle = pandoc.Div(title, pandoc.Attr("", {"value-box-title"}))
  vbArea.content:insert(vbTitle)

  -- The valuebox value
  local vbValue = pandoc.Div(value, pandoc.Attr("", {"value-box-value"}))
  vbArea.content:insert(vbValue)

  -- The rest of the contents
  if content ~= nil then
    vbArea.content:extend(content)
  end

  vbDiv.content:insert(vbArea)
  return makeCard(nil, {vbDiv}, classes)
end


function render_dashboard() 

  -- only do this for dashboad output
  if not _quarto.format.isDashboardOutput() then
    return {}
  end
  return {    {
      Pandoc = function(el)
        -- Make sections based upon the headings and use that for the 
        -- document structure
        local opts = PANDOC_WRITER_OPTIONS
        local result =  pandoc.structure.make_sections(el.blocks, opts)
        return pandoc.Pandoc(result, el.meta)
      end
    },
    {
      traverse = 'topdown',
      Div = function(el) 

        if el.classes:includes('card') then

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
          return makeCard(title, contents), false
        elseif el.classes:includes('valuebox') then

          local header = el.content[1]
          local title = {}
          local value = el.content
          local content = {}
          local icon = el.attributes['icon']
          local showcase = el.attributes['showcase'] or 'left-center'

          if header.t == "Header" then
            title = header.content
            value = tslice(el.content, 2)
          end
          
          local function showcaseClz(showcase)
            -- top-right
            -- left-center
            -- bottom
            return 'showcase-' .. showcase
          end
          
          if #value > 1 then
            content = tslice(value, 2)
            value = value[1]
          end


          if pandoc.utils.type(value) ~= "table" then
            value = {value}
          end
          return makeValueBox(title, pandoc.utils.blocks_to_inlines(value), icon, content, {'bslib-value-box', showcaseClz(showcase)}), false
        
        elseif el.classes:includes('section') then
          -- Allow sections to be 'cards'
          local header = el.content[1]
          if header.t == "Header" then            
            local level = header.level
            if level == 2 then
              local orientation = dashboardParam('orientation', 'columns')
              -- this means columns or rows (depending upon orientation)
              local contents = tslice(el.content, 2)
              if orientation == "columns" then
                return makeRows(contents), true
              else
                return makeCols(contents), true
              end
            else
              local contents = tslice(el.content, 2)
              return makeCard(header, contents), true
            end
          end
        end
      end,
    }
  }
end