-- dashboard.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- Layout classes
local kRowsClz = {"rows"}
local kColumnsClz = {"columns"}
local kLayoutFillClz = "fill"

-- Card classes
local kCardClz = "card"
local kCardHeaderClz = "card-header"
local kCardBodyClz = "card-body"

-- Valuebox classes
local kValueBoxClz = "valuebox"
local kValueBoxShowcaseClz = "value-box-showcase"
local kValueBoxAreaClz = "value-box-area"
local kValueBoxTitleClz = "value-box-title"
local kValueBoxValueClz = "value-box-value"

-- Valuebox attributes
local kValueBoxIconAttr = "icon"
local kValueBoxShowcaseAttr = "showcase"
local kValueBoxDefaultShowcasePosition = "left-center"

-- Page level data
local kParamOrientation = "orientation"
local kOrientationRows = "rows"
local kOrientationColumns = "columns"
local kDefaultOrientation = kOrientationRows
local kLayoutFlow = "flow"
local kLayoutFill = "fill"

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

local function dashboardParam(name, default) 
  local dashboard = param("dashboard", {})
  return dashboard[name] or default
end

local function htmlBsImage(icon)
  return pandoc.RawInline("html", '<i class="bi bi-' .. icon .. '"></i>')
end

local function showcaseClz(showcase)           
  -- top-right
  -- left-center
  -- bottom
  if showcase == nil then
    showcase = 'left-center'
  end
  return 'showcase-' .. showcase
end

local function makeRows(content, fill)
  local clz = pandoc.List(kRowsClz)
  if fill ~= false then
    clz:insert(kLayoutFillClz)
  end
  return pandoc.Div(content, pandoc.Attr("", clz))
end

local function makeCols(content, fill) 
  local clz = pandoc.List(kColumnsClz)
  if fill ~= false then
    clz:insert(kLayoutFillClz)
  end
  return pandoc.Div(content, pandoc.Attr("", clz))
end

-- title: string
-- contents: table
-- classes: table
-- Card DOM structure
-- .card[scrollable, max-height, min-height, full-screen(true, false), full-bleed?,]
--   .card-header
--   .card-body[max-height, min-height]
local function makeCard(title, contents, classes)  

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

  return pandoc.Div(cardContents, pandoc.Attr("", clz))
end


local function wrapValueBox(box, showcase, classes)
  local valueBoxClz = pandoc.List({kValueBoxClz, showcaseClz(showcase)})
  valueBoxClz:extend(classes)
  return makeCard(nil, {box}, valueBoxClz)
end


-- Make a valuebox
-- ValueBox DOM structure
-- .card .value-box[showcase(left-center,top-right,bottom), color(scss name, actual value)]
--   .value-box-grid
--     .value-box-showcase
--     .value-box-area
--       .value-box-title
--       .value-box-value
--        other content
local function makeValueBox(title, value, icon, content, showcase, classes) 
  if value == nil then
    error("Value boxes must have a value")
  end

  local vbDiv = pandoc.Div({}, pandoc.Attr("", {}))

  -- The valuebox icon
  if icon ~= nil then
    local bsImage = htmlBsImage(icon)
    local vbShowcase = pandoc.Div({bsImage}, pandoc.Attr("", {kValueBoxShowcaseClz}))
    vbDiv.content:insert(vbShowcase)
  end

  local vbArea = pandoc.Div({}, pandoc.Attr("", {kValueBoxAreaClz}))
  

  -- The valuebox title
  local vbTitle = pandoc.Div(title, pandoc.Attr("", {kValueBoxTitleClz}))
  vbArea.content:insert(vbTitle)

  -- The valuebox value
  local vbValue = pandoc.Div(value, pandoc.Attr("", {kValueBoxValueClz}))
  vbArea.content:insert(vbValue)

  -- The rest of the contents
  if content ~= nil then
    vbArea.content:extend(content)
  end

  vbDiv.content:insert(vbArea)
  return wrapValueBox(vbDiv, showcase, classes)
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
      PanelLayout = function(el)

        local result = makeRows({}, true)
        for i, row in ipairs(el.rows.content) do    
          
          local colsEl = makeCols({}, true)
          for j, cell_div in ipairs(row.content) do
            colsEl.content:insert(makeCard(nil, cell_div.content))
          end
          result.content:insert(colsEl)
        end
        return result, false
        
      end,
      Div = function(el) 

        if el.classes:includes(kCardClz) then

          -- see if the card is already in the correct structure (a single header and body)
          -- exit early, not processing if it is already processed in this way
          local cardHeader = el.content[1]
          local cardBody = el.content[2]
          local hasHeader = cardHeader ~= nil and cardHeader.classes ~= nil and cardHeader.classes:includes(kCardHeaderClz)
          local hasBody = cardBody ~= nil and cardBody.classes ~= nil and cardBody.classes:includes(kCardBodyClz)
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

        elseif el.classes:includes(kValueBoxClz) then

          -- We need to actually pull apart the box
          local header = el.content[1]
          local title = {}
          local value = el.content
          local content = {}
          local icon = el.attributes[kValueBoxIconAttr]          
          local showcase = el.attributes[kValueBoxShowcaseAttr] or kValueBoxDefaultShowcasePosition
          local classes = el.classes

          if header ~= nil and header.t == "Header" then
            title = header.content
            value = tslice(el.content, 2)
          end
          
          if #value > 1 then
            content = tslice(value, 2)
            value = value[1]
          end

          if pandoc.utils.type(value) ~= "table" and pandoc.utils.type(value) ~= "Blocks" then
            value = {value}
          end

          return makeValueBox(title, pandoc.utils.blocks_to_inlines(value), icon, content, showcase, classes), false
        
        elseif el.classes:includes('section') then
          -- Allow sections to be 'cards'
          local header = el.content[1]
          if header.t == "Header" then            
            local level = header.level
            if level == 2 then
              -- process a column or row separator
              local orientation = dashboardParam(kParamOrientation, kDefaultOrientation)
              local fill = header.attr.classes:includes(kLayoutFill) or not header.attr.classes:includes(kLayoutFlow)
              -- this means columns or rows (depending upon orientation)
              local contents = tslice(el.content, 2)
              if orientation == kOrientationColumns then
                return makeRows(contents, fill)
              else
                return makeCols(contents, fill)
              end
            else
              local contents = tslice(el.content, 2)
              return makeCard(header, contents), false
            end
          end
        elseif el.classes:includes('cell') then
          return makeCard(nil, el.content), false
        end
      end,
    }
  }
end