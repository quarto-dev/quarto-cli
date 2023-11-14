-- dashboard.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local dashboard = require 'modules/dashboard'

local constants = {
  kSectionClass = "section",
  kHiddenClass = "hidden",
  kIgnoreWhenOrganizingClz = {"section", "hidden"},  
}

local dashboardState = {
  previousCardTarget = nil,
  pendingCardToolbar = nil,
  pendingCardSidebar = nil,
  cardToolbarTargets = {
  },
  cardSidebarTargets = {
  },
  protectedBlocks = pandoc.List({})
}

local function setPendingCardToolbar(el)
  dashboardState.pendingCardToolbar = el
end

local function setPendingCardSidebar(el)
  dashboardState.pendingCardSidebar = el
end

local function popPendingCardToolbar()
  local pendingToolbar = dashboardState.pendingCardToolbar
  dashboardState.pendingCardToolbar = nil
  return pendingToolbar
end

local function popPendingSidebar()
  local pendingSidebar = dashboardState.pendingCardSidebar
  dashboardState.pendingCardSidebar = nil
  return pendingSidebar
end

function noteTargetForCardToolbar(toolbar, id) 
  dashboard.card_toolbar.markProcessed(toolbar)
  dashboardState.cardToolbarTargets[id] = dashboardState.cardToolbarTargets[id] or pandoc.List()
  dashboardState.cardToolbarTargets[id]:insert(toolbar)
end

function popCardTargetsForId(id) 
  local cardTargets = dashboardState.cardToolbarTargets[id]
  dashboardState.cardToolbarTargets[id] = nil
  return cardTargets
end

function noteTargetForCardSidebar(sidebar, id) 
  dashboard.card_sidebar.markProcessed(sidebar)
  dashboardState.cardSidebarTargets[id] = dashboardState.cardSidebarTargets[id] or pandoc.List()
  dashboardState.cardSidebarTargets[id]:insert(sidebar)
end

function popCardSidebarTargetsForId(id) 
  local cardTargets = dashboardState.cardSidebarTargets[id]
  dashboardState.cardSidebarTargets[id] = nil
  return cardTargets
end

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
      Pandoc = function(el)
        -- Note that HTML dependencies can get mangled (I think) in pandoc
        -- in particular when things are gathered into sections. So....
        -- This pops them out and just hangs onto them and then we inject them 
        -- afterwards to ensure they remain in place at the bottom of the document
        --
        --                __________________
        --                \                 \
        --                  \                 \
        --                    \                 \
        --                      \                 \
        --        /-------------------------------------
        --        //---------------//                  / |
        --        //               //                  / __|
        --        //               //                  / /  ||
        --        //               //                  / /    ||
        --        //_______________//   o o            / /      ||      ___/-\___
        --        ------------------------------------/   ------- |     |---------|
        --        | DO NOT PLAY |         | HOUSEHOLD |           |      | | | | |
        --        | ON OR AROUND|         |WASTE ONLY |           |      | | | | |
        --        |--------------         ------------|           |      | | | | |
        --        |                                   |           |      | | | | |
        --        -------------------------------------------------      |_______|
        local preserveInlinePattern = "preserve[0-9a-fA-F]"
        local blocks = pandoc.Blocks({})
        local collecting = false;
        for i, v in ipairs(el.blocks) do
          if v.t == "Para" then
            -- Any paragraphs that are composed only of HTML preserve strings
            -- and soft breaks will protected
            local isHtmlPreserve = true
            for j, w in ipairs(v.content) do
              if w.t ~= "Str" and w.t ~= "SoftBreak" then
                isHtmlPreserve = false
                break
              elseif w.t == "Str" and not w.text:match(preserveInlinePattern) then
                isHtmlPreserve = false
                break
              end
            end
            if isHtmlPreserve then
              dashboardState.protectedBlocks:insert(v)
            else
              blocks:insert(v)
            end
          elseif is_regular_node(v, "RawBlock") then
            -- Raw Blocks that are html_preserve comments or between
            -- those comments will be protected (contiguously)
            if v.text == "<!--html_preserve-->" then
              collecting = true;
              dashboardState.protectedBlocks:insert(v)
            elseif v.text == "<!--/html_preserve-->" then
              collecting = false;
              dashboardState.protectedBlocks:insert(v)
            elseif collecting then
              dashboardState.protectedBlocks:insert(v)
            else
              blocks:insert(v)
            end
          else
            -- stop collecting
            collecting = false
            blocks:insert(v)
          end  
        end
        el.blocks = blocks
        return el
      end,

      PanelLayout = function(el)
        local options, userClasses = dashboard.card.readOptions(el)
        return dashboard.card.makeCard({ el }, userClasses, options), false
      end,
      Div = function(el) 

        if el.attributes["output"] == "asis" then
          return nil

        elseif dashboard.card_sidebar.isCardSidebar(el) then
          
          -- Convert any card sidebars into their standard representation
          -- note that these will be process downstream to do things like 
          -- convert them into a card, or merge them into other card header/footers
          -- per the user's request 
          local options = dashboard.card_sidebar.readOptions(el)
          local cardSidebar = dashboard.card_sidebar.makeCardSidebar(el.content, options)
    
          local targetId = dashboard.card_sidebar.targetId(cardSidebar)
          if targetId ~= nil then
            noteTargetForCardSidebar(cardSidebar, targetId)
            return pandoc.Null(), false
          else
            return cardSidebar, false
          end

        elseif dashboard.card_toolbar.isCardToolbar(el) then
          
          -- Convert any card toolbars into their standard representation
          -- note that these will be process downstream to do things like 
          -- convert them into a card, or merge them into other card header/footers
          -- per the user's request 
          local options = dashboard.card_toolbar.readOptions(el)
          local cardToolbar = dashboard.card_toolbar.makeCardToolbar(el.content, options)

          local targetId = dashboard.card_toolbar.targetId(cardToolbar)
          if targetId ~= nil then
            noteTargetForCardToolbar(cardToolbar, targetId)
            return pandoc.Null(), false
          else
            return cardToolbar, false
          end
        
        elseif dashboard.card.isCard(el) then

          -- see if the card is already in the correct structure (a single header and body)
          -- exit early, not processing if it is already processed in this way
          if dashboard.card.isLiteralCard(el) then
            return nil
          end

          local contents = el.content          
          local options, userClasses = dashboard.card.readOptions(el)          
          return dashboard.card.makeCard(contents, userClasses, options), false

        elseif dashboard.valuebox.isValueBox(el) then
          
          return dashboard.valuebox.makeValueBox(el), false
        
        elseif el.classes:includes(dashboard.utils.constants.cell) and el.classes:includes("markdown") then
          
          -- See if this is explicitely a markdown cell (being preserved by a notebook)
          -- If so, provide some special handling which pops any markdown cell first header
          -- out and then treats the rest of the cell as a card

          -- First, if the user provided only a single element which is a card, just treat that
          -- as the user providing the card envelope (place the contents into a card whose
          -- options are determined by the card element that the user is providing)
          if #el.content == 1 and dashboard.card.isCard(el.content[1]) then
            local options, userClasses = dashboard.card.readOptions(el.content[1])
            return dashboard.card.makeCard(el.content[1].content, userClasses, options)

          else
            -- Otherwise, look more closely at the markdown contents and figure out 
            -- how to best handle
            local options, userClasses = dashboard.card.readOptions(el)
            if options[dashboard.card.optionKeys.layout] == nil then
              options[dashboard.card.optionKeys.layout] = dashboard.card.optionValues.flow
            end

            local results = pandoc.List()
            local cardContent = el.content
            if #el.content > 0 and el.content[1].t == "Header" then              
              results:insert(el.content[1])
              cardContent = tslice(cardContent, 2)              
            end

            local card = dashboard.card.makeCard(cardContent, userClasses, options)
            if card ~= nil then
              results:insert(card)
            end
            
            if #results > 0 then
              return pandoc.Blocks(results)
            end
          end

        elseif el.classes:includes(dashboard.utils.constants.cell) then

          -- Process a standard code cell. In particular, we should be 
          -- looking to try to determine the visibility and processing behavior
          -- for the cell

          -- See if this cell has bslib output already
          local isHidden = false
          local isMarkdownOutput = false

          local bslibRawOutputs = pandoc.List()
          el = _quarto.ast.walk(el,  {
            Div = function(childDiv)  
              if childDiv.classes:includes(dashboard.utils.constants.cell_output_display) then

                  -- Note whether we see any markdown cells
                  if childDiv.classes:includes("cell-output-markdown") then
                    isMarkdownOutput = true
                  end

                  if #childDiv.content == 1 and childDiv.content[1].t == "RawBlock" and childDiv.content[1].format == "html" then
                    if childDiv.content[1].text:match('bslib-') ~= nil then
                      -- capture any raw blocks that we see
                      bslibRawOutputs:insert(childDiv.content[1])

                      -- Don't emit these within the cell outputs
                      return pandoc.Null()
                    end
                  end
              end

              -- Note whether there are hidden elements in the cell
              isHidden = isHidden or childDiv.classes:includes(constants.kHiddenClass)
            end
          })


          -- If the element is marked hidden or the element
          -- has bslib output (e.g. it is code that is outputing bslib components)
          -- give it special treatment
          if #bslibRawOutputs > 0 then
            -- If bslib outputs were detected, we need to elevate those rawblocks and 
            -- just allow them to pass through the system unharmed along side
            -- the cell and any of its other output
            local result = pandoc.Blocks(bslibRawOutputs)
            if el ~= nil and #el.content > 0 then
              local options, userClasses = dashboard.card.readOptions(el)
              local card = dashboard.card.makeCard(el.content, userClasses, options)
              if card ~= nil then
                result:insert(card)
              end
            end
            return result
          elseif isHidden then
            if el ~= nil then
              el.classes:insert(constants.kHiddenClass)
            end
            return el
          else
            -- Look for markdown explictly being output
            local options, userClasses = dashboard.card.readOptions(el)

            -- if not explicitly set, mark markdown cells as flow
            if isMarkdownOutput and options[dashboard.card.optionKeys.layout] == nil then
              options[dashboard.card.optionKeys.layout] = dashboard.card.optionValues.flow
            end

            -- Try to read the title from any programmatic output
            -- in case it is showing up that way
            local cardContent = el.content
            if #cardContent > 1 and is_regular_node(cardContent[1], "Div") and not is_custom_node(cardContent[1]) then
              if cardContent[1].classes:includes('cell-output-stdout') then

                -- See if the content is a CodeBlock 
                local codeBlockEl = cardContent[1].content[1]
                if codeBlockEl.t == "CodeBlock"  then

                  local titlePrefix = "title="
                  local prefixLen = pandoc.text.len(titlePrefix)

                  local strValue = codeBlockEl.text
                  if pandoc.text.len(strValue) > prefixLen then
                    options['title'] = trim(pandoc.text.sub(codeBlockEl.text, prefixLen + 1))
                  end
                end
                cardContent = tslice(cardContent, 2)
              end
            end

            return dashboard.card.makeCard(cardContent, userClasses, options), false
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
          if v.classes ~= nil and (v.classes:includes(constants.kSectionClass) or dashboard.card.isCard(v)) then
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
        local organizer = dashboard.layoutContainer.organizer(layoutEls, pandoc.List(constants.kIgnoreWhenOrganizingClz))
        local layoutContentEls = organizer.ensureInLayoutContainers()
        
        -- force the global orientation to columns if there is a sidebar present
        local inferredOrientation = dashboard.suggestOrientation(el)
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
        if el.classes:includes(constants.kSectionClass) then

            -- Allow arbitrary nesting of sections / heading levels to perform layouts
          local header = el.content[1]

          if header.t == "Header" then            
            local level = header.level
            local contents = tslice(el.content, 2)

            -- The first time we see a level, we should emit the rows and 
            -- flip the orientation
            if dashboard.sidebar.isSidebar(header) then
              -- resolve headers inside the sidebar
              local resolved = dashboard.escapeLeafNodeContents(pandoc.Blocks(contents))
              el.content = pandoc.List({})
              if resolved ~= nil then
                el.content:extend(resolved)
              end
              return el, false

            elseif dashboard.toolbar.isToolbar(header) then
              local resolved = dashboard.escapeLeafNodeContents(pandoc.Blocks(contents))
              el.content = pandoc.List({})
              if resolved ~= nil then
                el.content:extend(resolved)
              end
              return el, false
            elseif level == 1 then
                -- A level 1 header marked as a sidebar is global, just let it
                -- flow through and the sidebar collector will ingest it and convert it into 
                -- a sidebar (which contains the other pages as its content)
              if dashboard.sidebar.isSidebar(header) then
                local options = dashboard.sidebar.readOptions(header)
                return dashboard.sidebar.pageSidebarPlaceholder(contents, options)
              elseif dashboard.toolbar.isToolbar(header) then
                local options = dashboard.toolbar.readOptions(header)
                return dashboard.toolbar.pageToolbarPlaceholder(contents, options)
              else
                lastLevel = level

                -- Make sure everything is in a card
                local organizer = dashboard.layoutContainer.organizer(contents, pandoc.List(constants.kIgnoreWhenOrganizingClz))
                local layoutContentEls = organizer.ensureInLayoutContainers()

                -- Convert this to a page
                local options = dashboard.page.readOptions(header)
                local page = dashboard.page.makePage(el.identifier, header, layoutContentEls, options)
                return page
              end
            else

              -- Make sure everything is in a card
              local organizer = dashboard.layoutContainer.organizer(contents, pandoc.List(constants.kIgnoreWhenOrganizingClz))
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
                  local inferredOrientation = dashboard.suggestOrientation(el)
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
    },
    {
      traverse = 'topdown',
      Blocks = function(blocks)
        -- Track the last card and any pending card toolbars to be joined
        -- to cards
        local result = pandoc:Blocks()
        for _i, v in ipairs(blocks) do
          if is_regular_node(v, "Div") then
          
            if dashboard.card.isCard(v) then
              -- If there is a pending card toolbar, then insert it into
              -- this card (note that a pending card toolbar will only
              -- be present if the card is to be inserted into the below
              -- container)
              local pendingToolbar = popPendingCardToolbar()
              if pendingToolbar ~= nil then
                dashboard.card_toolbar.addToTarget(pendingToolbar, v, dashboard.card.addToHeader, dashboard.card.addToFooter)
              end

              -- if thers is a pending card sidebar, inject that
              local pendingSidebar = popPendingSidebar()
              if pendingSidebar ~= nil then
                dashboard.card_sidebar.addToTarget(pendingSidebar, v, dashboard.card.addSidebar)
              end

              -- inject any specifically target card toolbars or sidebars
              local possibleTargetIds = dashboard.utils.idsWithinEl(v)
              if possibleTargetIds ~= nil then
                for _j, targetId in ipairs(possibleTargetIds) do
                  local toolbarsForTarget = popCardTargetsForId(targetId)
                  if toolbarsForTarget ~= nil then
                    for _j,toolbar in ipairs(toolbarsForTarget) do
                      dashboard.card_toolbar.addToTarget(toolbar, v, dashboard.card.addToHeader, dashboard.card.addToFooter)
                    end
                  end    

                  local sidebarsForTarget = popCardSidebarTargetsForId(targetId)
                  if sidebarsForTarget ~= nil then
                    for _k,sidebar in ipairs(sidebarsForTarget) do
                      dashboard.card_sidebar.addToTarget(sidebar, v, dashboard.card.addSidebar)
                    end
                  end
                end
              end

              result:insert(v)
              dashboardState.previousCardTarget = v

            elseif (dashboard.tabset.isTabset(v)) then
              -- If there is a pending card toolbar, then insert it into
              -- this tabset (note that a pending card toolbar will only
              -- be present if the card is to be inserted into the below
              -- container)
              local pendingToolbar = popPendingCardToolbar()
              if pendingToolbar ~= nil then
                dashboard.card_toolbar.addToTarget(pendingToolbar, v, dashboard.tabset.addToHeader, dashboard.tabset.addToFooter)
              end

              -- if thers is a pending card sidebar, inject that
              local pendingSidebar = popPendingSidebar()
              if pendingSidebar ~= nil then
                dashboard.card_sidebar.addToTarget(pendingSidebar, v, dashboard.tabset.addSidebar)
              end
              
              -- inject an specifically target card toolbars
              local possibleTargetIds = dashboard.utils.idsWithinEl(v)
              if possibleTargetIds ~= nil then
                for _j, targetId in ipairs(possibleTargetIds) do
                  local toolbarsForTarget = popCardTargetsForId(targetId)
                  if toolbarsForTarget ~= nil then
                    for _j,toolbar in ipairs(toolbarsForTarget) do
                      dashboard.card_toolbar.addToTarget(toolbar, v, dashboard.tabset.addToHeader, dashboard.tabset.addToFooter)
                    end
                  end    

                  local sidebarsForTarget = popCardSidebarTargetsForId(targetId)
                  if sidebarsForTarget ~= nil then
                    for _k,sidebar in ipairs(sidebarsForTarget) do
                      dashboard.card_sidebar.addToTarget(sidebar, v, dashboard.tabset.addSidebar)
                    end
                  end                  
                end
              end
              
              result:insert(v)
              dashboardState.previousCardTarget = v

            elseif dashboard.card_toolbar.isCardToolbar(v) and dashboard.card_toolbar.isUnprocessed(v) then
              -- If this is an unprocessed card toolbar, mark it processed and handle it appropriately
              dashboard.card_toolbar.markProcessed(v)
              if dashboard.card_toolbar.targetPrevious(v) then
                -- This is for a the card/tabset that appears above
                if dashboardState.previousCardTarget == nil then
                  fatal("A card toolbar specified to insert into previous card or tabset, but there was no previous card or tabset.")
                elseif dashboard.card.isCard(dashboardState.previousCardTarget) then
                  dashboard.card_toolbar.addToTarget(v, dashboardState.previousCardTarget, dashboard.card.addToHeader, dashboard.card.addToFooter)
                elseif dashboard.tabset.isTabset(dashboardState.previousCardTarget) then
                  dashboard.card_toolbar.addToTarget(v, dashboardState.previousCardTarget, dashboard.tabset.addToHeader, dashboard.tabset.addToFooter)
                else
                  fatal("Unexpected element " .. dashboardState.previousCardTarget.t .. "appearing as the target for a card toolbar.")
                end
              elseif dashboard.card_toolbar.targetNext(v) then
                -- This card toolbar belongs in the next card, hang onto it
                -- don't inject it
                setPendingCardToolbar(v)
              else
                -- Free floating card toolbar, place it in a card
                local userClasses, cardOptions = dashboard.card.readOptions(v)
                cardOptions[dashboard.card.optionKeys.expandable] = false
                cardOptions[dashboard.card.optionKeys.layout] = dashboard.card.optionValues.flow
                result:insert(dashboard.card.makeCard({v}, userClasses, cardOptions))
              end
            elseif dashboard.card_sidebar.isCardSidebar(v) and dashboard.card_sidebar.isUnprocessed(v) then
              -- If this is an unprocessed card sidebar, mark it processed and handle it appropriately
              dashboard.card_sidebar.markProcessed(v)
              if dashboard.card_sidebar.targetPrevious(v) then
                -- This is for a the card/tabset that appears above
                if dashboardState.previousCardTarget == nil then
                  fatal("A card sidebar specified to insert into previous card or tabset, but there was no previous card or tabset.")
                elseif dashboard.card.isCard(dashboardState.previousCardTarget) then
                  dashboard.card_sidebar.addToTarget(v, dashboardState.previousCardTarget, dashboard.card.addSidebar)
                elseif dashboard.tabset.isTabset(dashboardState.previousCardTarget) then
                  dashboard.card_sidebar.addToTarget(v, dashboardState.previousCardTarget, dashboard.tabset.addSidebar)
                else
                  fatal("Unexpected element " .. dashboardState.previousCardTarget.t .. "appearing as the target for a card sidebar.")
                end
              elseif dashboard.card_sidebar.targetNext(v) then
                -- This card toolbar belongs in the next card, hang onto it
                -- don't inject it
                setPendingCardSidebar(v)
              else
                -- Free floating card sidebar, place it in a card
                local userClasses, cardOptions = dashboard.card.readOptions(v)
                cardOptions[dashboard.card.optionKeys.expandable] = false
                cardOptions[dashboard.card.optionKeys.layout] = dashboard.card.optionValues.flow
                result:insert(dashboard.card.makeCard({v}, userClasses, cardOptions))
              end

            else 
              result:insert(v)  
            end
          else 
            result:insert(v)
          end
        end
        return result
      end,      
      Div = function(el) 
        if dashboard.layout.isRowOrColumnContainer(el) and #el.content == 0 then
          -- don't emit completely empty layout containers
          return pandoc.Null()
        elseif dashboard.layout.isColumnContainer(el) then

          local sidebar = nil
          local sidebarBottom = false
          local sidebarContent = pandoc.List({})
          for i, v in ipairs(el.content) do   
            if dashboard.sidebar.isSidebar(v) then         
              sidebar = v
            else
              sidebarContent:insert(v)
              if i == 1 then
                sidebarBottom = true
              end
            end
          end

          if sidebar then
            local options = dashboard.sidebar.readOptions(sidebar)
            if sidebarBottom then
              
              dashboard.sidebar.setPositionEnd(options)
            end
            return dashboard.sidebar.makeSidebar(sidebar.content, sidebarContent, options)  
          end    
        elseif dashboard.layout.isRowContainer(el) then

          local toolbar = nil
          local toolbarContent = pandoc.List({})
          local toolbarBottom = false
          for i, v in ipairs(el.content) do   
            if dashboard.toolbar.isToolbar(v) then         
              toolbar = v
            else
              toolbarContent:insert(v)
              if i == 1 then
                -- if we see content before the toolbar
                -- then it should be placed at the bottom
                toolbarBottom = true
              end
            end
          end

          if toolbar then
            local options = dashboard.toolbar.readOptions(sidebar)
            if toolbarBottom then
              dashboard.toolbar.setPositionEnd(options)
            end
            return dashboard.toolbar.makeToolbar(toolbar.content, toolbarContent, options)
          end    


        end

      end,
    }, {
      Pandoc = function(doc) 

        -- If there is still a pending card toolbar, that means that the user
        -- placed inputs at the end of the document with no cards or tabsets following
        local pendingToolbar = popPendingCardToolbar()
        if pendingToolbar ~= nil then
          fatal("The card toolbar was unable to placed within the next card or tabset as there was no next card or tabset.")
        end

        local pendingSidebar = popPendingSidebar()
        if pendingSidebar ~= nil then
          fatal("The card sidebar was unable to placed within the next card or tabset as there was no next card or tabset.")
        end
        

        -- If there are ids that haven't been resolved, that means that the user targeted ids with
        -- inputs and those ids were never found, so the card toolbar was never placed.
        local missingIds = pandoc.List()
        for k,v in pairs(dashboardState.cardToolbarTargets) do
          missingIds:insert(k)
        end
        for l, v in pairs(dashboardState.cardSidebarTargets) do
          missingIds:insert(l)
        end
        
        if #missingIds > 0 then
          fatal("A card toolbar or sidebar failed to be placed within a card or tabset using an id. The following id(s) could not be found in the document:\n" .. table.concat(missingIds, ", "))
        end

        if #dashboardState.protectedBlocks > 0 then
          doc.blocks:extend(dashboardState.protectedBlocks)
          return doc
        end
      end
    }
  }
end