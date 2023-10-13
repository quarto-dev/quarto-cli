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

  local function orientContents(contents, orientation, options)
    if orientation == kOrientationColumns then
      return dashboard.layout.makeCols(contents, options)
    else
      return dashboard.layout.makeRows(contents, options)
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
      PanelLayout = function(el)
        local options, userClasses = dashboard.card.readCardOptions(el)          
        return dashboard.card.makeCard(nil, el, userClasses, options), false
      end,
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
          
          return dashboard.valuebox.makeValueBox(el), false
                  
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
                  

          if hasBsLibOutput then
            return el
          else
            local options, userClasses = dashboard.card.readCardOptions(el)
            return dashboard.card.makeCard(nil, el.content, userClasses, options), false
          end
        end
      end,      

    },
    {
      traverse = 'topdown',
      Pandoc = function(el)
        
        -- Look for global fill setting
        local fill = dashboardParam(kLayoutFill, false)
        local options = dashboard.layout.makeOptions(fill)

        -- Make sections based upon the headings and use that for the 
        -- document structure
        el.blocks = pandoc.structure.make_sections(el.blocks, {})

        -- Layout the root element with a specific orientation
        el.blocks = orientContents(el.blocks, orientation(), options)
        return el

      end,
      Div = function(el) 

        if el.classes:includes('section') then

          -- Allow arbitrary nesting of sections / heading levels to perform layouts
          local header = el.content[1]
          if header.t == "Header" then            
            local level = header.level

            -- The first time we see a level, we should emit the rows and 

            if level > 1 then
              -- Compute the options
              local options = dashboard.layout.readOptions(header)

              if level ~= lastLevel then

                -- Note the new level
                lastLevel = level
                              
                local contents = tslice(el.content, 2)
                return orientContents(contents, alternateOrientation(), options)
              else 
               
                local contents = tslice(el.content, 2)
                return orientContents(contents, orientation(), options)
              end
            end
          end
        end      
      end,
    }
  }
end