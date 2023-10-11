-- dashboard.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local dashboard = require 'modules/dashboard'

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

-- param name
local kParamKey = "dashboard"

local function dashboardParam(name, default) 
  local dashboardParams = param(kParamKey, {})
  return dashboardParams[name] or default
end

function render_dashboard() 

  -- Track the orientation that is used to perform heading based layout
  -- the basic idea is to alternate the orientation at new heading levels
  local lastLevel = 0
  local currentOrientation = dashboardParam(kParamOrientation, kDefaultOrientation)

  local function alternateOrientation() 
    if currentOrientation == kOrientationRows then
      currentOrientation = kOrientationColumns
    else
      currentOrientation = kOrientationRows
    end 
    return currentOrientation
  end

  local function orientation() 
    return currentOrientation
  end

  local function orientContents(contents, orientation, fill)
    if orientation == kOrientationColumns then
      return dashboard.layout.makeCols(contents, fill)
    else
      return dashboard.layout.makeRows(contents, fill)
    end
  end


  -- only do this for dashboad output
  if not _quarto.format.isDashboardOutput() then
    return {}
  end

  -- This happens in 2 passes:
  -- The first pass will resolve cards, valueboxes, etc...
  -- The second pass will layout the dashboard
    return {    
    {
      traverse = 'topdown',
      Div = function(el) 

        if dashboard.card.isCard(el) then

          -- see if the card is already in the correct structure (a single header and body)
          -- exit early, not processing if it is already processed in this way
          if dashboard.card.isLiteralCard(el) then
            return nil
          end

          -- Support explicit cards as divs (without the proper nested structure)
          -- First element as a header will be used as the title, if present
          -- otherwise just use the contents as the card body
          local header = el.content[1]
          local title = {}
          local contents = el.content
          if header ~= nil and header.t == "Header" then
            title = header
            contents = tslice(el.content, 2)
          end
          
          local options, userClasses = dashboard.card.readCardOptions(el)          
          return dashboard.card.makeCard(title, contents, userClasses, options), false

        elseif dashboard.valuebox.isValueBox(el) then

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

          return dashboard.valuebox.makeValueBox(title, pandoc.utils.blocks_to_inlines(value), icon, content, showcase, classes), false
                  
        elseif el.classes:includes('cell') then
          
          -- See if this cell has bslib output already
          local hasBsLibOutput = false
          _quarto.ast.walk(el,  {
            Div = function(childDiv)  
              if childDiv.classes:includes('cell-output-display') then
                local outputStr = pandoc.utils.stringify(childDiv.content)
                -- TODO: We probably should be a little more careful about
                -- this check
                hasBsLibOutput = outputStr:match('bslib-')
              end
            end
          })
          
          local options = {}
          if el.attributes['title'] then
            options['title'] = el.attributes['title']
          end
          

          if hasBsLibOutput then
            return el
          else
            return dashboard.card.makeCard(nil, el.content, {}, options), false
          end
        end
      end,      

    },
    {
      traverse = 'topdown',
      Pandoc = function(el)
        
        -- Look for global fill setting
        local fill = dashboardParam(kLayoutFill, false)

        -- Make sections based upon the headings and use that for the 
        -- document structure
        el.blocks = pandoc.structure.make_sections(el.blocks, {})

        -- Layout the root element with a specific orientation
        el.blocks = orientContents(el.blocks, orientation(), fill)
        return el

      end,
      PanelLayout = function(el)
        -- Convert panel layouts into rows and columns using the 
        -- dashboard syntax
        local result = dashboard.layout.makeRows({}, true)
        for _i, row in ipairs(el.rows.content) do              
          local colsEl = dashboard.layout.makeCols({}, true)
          for _j, cell_div in ipairs(row.content) do
            colsEl.content:insert(dashboard.card.makeCard(nil, cell_div.content))
          end
          result.content:insert(colsEl)
        end
        return result, false
        
      end,
      Div = function(el) 

        if el.classes:includes('section') then

          -- Allow arbitrary nesting of sections / heading levels to perform layouts
          local header = el.content[1]
          if header.t == "Header" then            
            local level = header.level

            -- The first time we see a level, we should emit the rows and 

            if level > 1 then
              if level ~= lastLevel then

                -- Compute the fill
                local fill = header.attr.classes:includes(kLayoutFill) or not header.attr.classes:includes(kLayoutFlow)

                -- Note the new level
                lastLevel = level
                              
                local contents = tslice(el.content, 2)
                return orientContents(contents, alternateOrientation(), fill)
              else 
               
                local contents = tslice(el.content, 2)
                return orientContents(contents, orientation(), fill)
              end
            end
          end
        end      
      end,
    }
  }
end