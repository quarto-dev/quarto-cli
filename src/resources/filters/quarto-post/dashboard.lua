-- dashboard.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local dashboard = require 'modules/dashboard'

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

  -- This happens in 2 passes:
  -- The first pass will resolve cards, valueboxes, etc...
  -- The second pass will layout the dashboard
    return {    
    {
      traverse = 'topdown',
      PanelLayout = function(el)
        if (el.attributes['dashboard-resolved'] == true) then
          return el
        end
        local options, userClasses = dashboard.card.readOptions(el)
        el.attributes['dashboard-resolved'] = true
        return dashboard.card.makeCard(nil, { el }, userClasses, options), false
      end,
      Div = function(el) 

        if el.attributes["output"] == "asis" then
          return nil
        elseif dashboard.card.isCard(el) then

          -- see if the card is already in the correct structure (a single header and body)
          -- exit early, not processing if it is already processed in this way
          if dashboard.card.isLiteralCard(el) then
            return nil
          end

          local contents = el.content          
          local options, userClasses = dashboard.card.readOptions(el)          
          return dashboard.card.makeCard(nil, contents, userClasses, options), false

        elseif dashboard.valuebox.isValueBox(el) then
          
          return dashboard.valuebox.makeValueBox(el), false
        
        elseif el.classes:includes(kCellClass)  then
          
          -- See if this cell has bslib output already
          local hasBsLibOutput = false
          local isHidden = false
          local isMarkdownOutput = false
          _quarto.ast.walk(el,  {
            Div = function(childDiv)  
              if childDiv.classes:includes(kCellOutputDisplayClass) then
                local outputStr = pandoc.utils.stringify(childDiv.content)
                -- TODO: We probably should be a little more careful about
                -- this check
                hasBsLibOutput = hasBsLibOutput or outputStr:match('bslib-')

                if childDiv.classes:includes("cell-output-markdown") then
                  isMarkdownOutput = true
                end
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
            -- Look for markdown explictly being output
            local options, userClasses = dashboard.card.readOptions(el)
            -- if not explicitly set, mark markdown cells as flow
            if isMarkdownOutput and options[dashboard.card.optionKeys.layout] == nil then
              options[dashboard.card.optionKeys.layout] = dashboard.card.optionValues.flow
            end

            return dashboard.card.makeCard(nil, el.content, userClasses, options), false
          end
        end
      end,      

    },
    {
      traverse = 'topdown',
      Pandoc = function(el)
        
        -- Look for global fill setting
        local options = dashboard.layout.makeOptions(dashboard.document.scrolling)

        -- Make sections based upon the headings and use that for the 
        -- document structure
        -- el is a 'Pandoc' object which has blocks which is Blocks, not a list, I can't explain this warning
        el.blocks = pandoc.structure.make_sections(el.blocks, {}) 

        -- Now that the document has been re-organized, gather any
        -- loose elements that appear before the first section and cleave them
        -- out for use later
        -- Once we've visited a card or section, any subsequent content that appears loose is
        -- no longer considered above the fold
        local nonSectionEls = pandoc.List()
        local sectionEls = pandoc.List()
        local visitedSectionOrCard = false
        for _i, v in ipairs(el.blocks) do
          if v.classes ~= nil and (v.classes:includes(kSectionClass) or dashboard.card.isCard(v)) then
            sectionEls:insert(v)
            visitedSectionOrCard = true
          else
            if visitedSectionOrCard then
              sectionEls:insert(v)
            else 
              nonSectionEls:insert(v)             
            end
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
        
        -- force the global orientation to columns if there is a sidebar present
        local inferredOrientation = dashboard.layout.inferOrientation(el)
        if inferredOrientation ~= nil then 
          dashboard.layout.setOrientation(inferredOrientation)
        end

        -- Layout the proper elements with a specific orientation
        local cardsWithLayoutEl = dashboard.layout.orientContents(layoutContentEls, dashboard.layout.currentOrientation(), options)
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

            -- The first time we see a level, we should emit the rows and 
            -- flip the orientation
            if level == 1 then
                -- A level 1 header marked as a sidebar is global, just let it
                -- flow through and the sidebar collector will ingest it and convert it into 
                -- a sidebar (which contains the other pages as its content)
              if dashboard.sidebar.isSidebar(header) then
                return dashboard.sidebar.pageSidebarPlaceholder(contents)
              else
                lastLevel = level

                -- Make sure everything is in a card
                local organizer = dashboard.layoutContainer.organizer(contents, pandoc.List(kIgnoreWhenOrganizingClz))
                local layoutContentEls = organizer.ensureInLayoutContainers()

                -- Convert this to a page
                local options = dashboard.page.readOptions(header)
                local page = dashboard.page.makePage(el.identifier, header, layoutContentEls, options)
                return page
              end
            else

              -- Make sure everything is in a card
              local organizer = dashboard.layoutContainer.organizer(contents, pandoc.List(kIgnoreWhenOrganizingClz))
              local layoutContentEls = organizer.ensureInLayoutContainers()

              -- see if this heading is marked as a tabset
              if dashboard.tabset.isTabset(header) then 
                -- Process the component
                local options, userClasses = dashboard.tabset.readOptions(header)
                -- don't pass an explicit title - any title will come from the card options
                return dashboard.tabset.makeTabset(nil, contents, userClasses, options)
              else
                -- Process the layout
                            
                -- TODO: extend to other component types for completeness
                if dashboard.card.hasCardDecoration(header) then
                  -- sections may not have component decorations, throw error
                  fatal("Headings may not be cards - please remove the `card` class from the offending heading: '" .. pandoc.utils.stringify(header) .. "'")
                end

                -- Compute the options
                local options = dashboard.layout.readOptions(header)
                local toOrientation = dashboard.layout.currentOrientation()
                if level ~= lastLevel then
                  -- Note the new level
                  lastLevel = level

                  -- force the global orientation to columns if there is a sidebar present
                  local inferredOrientation = dashboard.layout.inferOrientation(el)
                  if inferredOrientation ~= nil then 
                    toOrientation = dashboard.layout.setOrientation(inferredOrientation)
                  else
                    toOrientation = dashboard.layout.rotatedOrientation()
                  end
                end        
                return dashboard.layout.orientContents(layoutContentEls, toOrientation, options)
              end
            end
          end
        end      
      end,
    }, {
      traverse = 'topdown',
      Div = function(el) 
        if dashboard.layout.isRowOrColumnContainer(el) and #el.content == 0 then
          -- don't emit completely empty layout containers
          return pandoc.Null()
        elseif dashboard.layout.isColumnContainer(el) then

          local sidebar = nil
          local sidebarContent = pandoc.List({})
          for _i, v in ipairs(el.content) do   
            if dashboard.sidebar.isSidebar(v) then         
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