-- dashboard.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local dashboard = require 'modules/dashboard'

-- Page level data
local kOrientationRows = "rows"
local kOrientationColumns = "columns"

local kSectionClass = "section"
local kHiddenClass = "hidden"
local kIgnoreWhenOrganizingClz = {kSectionClass, kHiddenClass}

local kCellClass = "cell"
local kCellOutputDisplayClass = "cell-output-display"

function render_dashboard() 

  -- only do this for dashboad output
  if not _quarto.format.isDashboardOutput() then
    return {}
  end

  -- Track the orientation that is used to perform heading based layout
  -- the basic idea is to alternate the orientation at new heading levels
  local lastLevel = 0
  local currentOrientation = dashboard.document.orientation

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
      return dashboard.layout.makeRowContainer(contents, options)
    else
      return dashboard.layout.makeColumnContainer(contents, options)
    end
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
        
        elseif el.classes:includes(kCellClass)  then
          
          -- See if this cell has bslib output already
          local hasBsLibOutput = false
          local isHidden = false
          _quarto.ast.walk(el,  {
            Div = function(childDiv)  
              if childDiv.classes:includes(kCellOutputDisplayClass) then
                local outputStr = pandoc.utils.stringify(childDiv.content)
                -- TODO: We probably should be a little more careful about
                -- this check
                hasBsLibOutput = hasBsLibOutput or outputStr:match('bslib-')
              end
              isHidden = isHidden or childDiv.classes:includes(kHiddenClass)
            end
          })
          -- If the element is marked hidden or the element
          -- has bslib output (e.g. it is code that is outputing bslib components)
          -- just let it through as is
          if hasBsLibOutput or isHidden then
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
        local options = dashboard.layout.makeOptions(dashboard.document.fill)

        -- Make sections based upon the headings and use that for the 
        -- document structure
        -- el is a 'Pandoc' object which has blocks which is Blocks, not a list, I can't explain this warning
        el.blocks = pandoc.structure.make_sections(el.blocks, {}) 

        -- Now that the document has been re-organized, gather any
        -- loose elements that appear before the first section and cleave them
        -- out for use later
        local nonSectionEls = pandoc.List()
        local sectionEls = pandoc.List()
        for _i, v in ipairs(el.blocks) do
          if v.classes ~= nil and v.classes:includes(kSectionClass) then
            sectionEls:insert(v)
          else
            nonSectionEls:insert(v)
          end
        end

        -- Sort out whether we're snagging loose content above
        -- sections (e.g. if there is a section)
        local layoutEls = nonSectionEls
        local finalEls = pandoc.List()
        if #sectionEls > 0 then
          layoutEls = sectionEls
          finalEls = nonSectionEls
        end

        -- ensure that root level elements are containers
        local organizer = dashboard.layoutContainer.organizer(layoutEls, pandoc.List(kIgnoreWhenOrganizingClz))
        local layoutContentEls = organizer.ensureInLayoutContainers()
        
        -- Layout the proper elements with a specific orientation
        local cardsWithLayoutEl = orientContents(layoutContentEls, orientation(), options)
        finalEls:insert(cardsWithLayoutEl)

        -- return the newly restructured document
        el.blocks = finalEls
        return el

      end,
      Div = function(el) 
        if el.classes:includes(kSectionClass) then

          -- Allow arbitrary nesting of sections / heading levels to perform layouts
          local header = el.content[1]
          if header.t == "Header" then            
            local level = header.level
            local contents = tslice(el.content, 2)

            -- Make sure everything is in a card
            local organizer = dashboard.layoutContainer.organizer(contents, pandoc.List(kIgnoreWhenOrganizingClz))
            local layoutContentEls = organizer.ensureInLayoutContainers()
            
            -- The first time we see a level, we should emit the rows and 
            -- flip the orientation
            if level == 1 then

              -- Convert this to a page
              local options = dashboard.page.readOptions(header)
              return dashboard.page.makePage(header, contents, options)

            else

              -- see if this heading is marked as a component
              if dashboard.card.isCard(header) then 
                -- Process the component
                local options, userClasses = dashboard.card.readCardOptions(header)
                -- don't pass an explicit title - any title will come from the card options
                return dashboard.card.makeCard(nil, contents, userClasses, options)
              else
                -- Process the layout

                -- Compute the options
                local options = dashboard.layout.readOptions(header)
                if level ~= lastLevel then
                  -- Note the new level
                  lastLevel = level
                  return orientContents(layoutContentEls, alternateOrientation(), options)
                else 
                  return orientContents(layoutContentEls, orientation(), options)
                end
              end
            end
          end
        end      
      end,
    }, {
      traverse = 'topdown',
      Div = function(el) 
        if dashboard.layout.isRowOrColContainer(el) and #el.content == 0 then
          -- don't emit completely empty layout containers
          return pandoc.Null()
        elseif el.classes:includes('columns') then

          local sidebar = nil
          local sidebarContent = pandoc.List({})
          for i, v in ipairs(el.content) do            
            if v.classes:includes('sidebar') then
              sidebar = v
            else
              sidebarContent:insert(v)
            end
          end

          if sidebar then
            local options = dashboard.sidebar.readOptions(el)
            return dashboard.sidebar.makeSidebar(sidebar.content, sidebarContent, options)  
          end          
        end

      end,
    }
  }
end