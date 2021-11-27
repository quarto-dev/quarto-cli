-- panel-sidebar.lua
-- Copyright (C) 2021 by RStudio, PBC

function panelSidebar() 
  return {
    Blocks = function(blocks)
      if hasBootstrap() then

        -- functions to determine if an element has a layout class
        function isSidebar(el)
          return el.t == "Div" and el.attr.classes:includes("panel-sidebar")
        end
        function isContainer(el)
          return el.t == "Div" and 
                 (el.attr.classes:includes("panel-fill") or 
                  el.attr.classes:includes("panel-center") or
                  el.attr.classes:includes("panel-tabset"))
        end
        function isQuartoHiddenDiv(el)
          return el.t == "Div" and
                 string.find(el.attr.identifier, "^quarto%-") and
                 el.attr.classes:includes("hidden")
        end
        function isNotQuartoHiddenDiv(el)
          return not isQuartoHiddenDiv(el)
        end

        -- bail if there are no sidebars
        local sidebar, sidebarIdx = blocks:find_if(isSidebar)
        if not sidebar then
          return blocks
        end


        -- if there are no container classes in the list then
        -- implicitly create a panel-fill if the sidebar is at the
        -- beginning or the end or the list
        if not blocks:find_if(isContainer) and #blocks > 1 then
          
          -- filter out quarto hidden blocks (they'll get put back in after processing)
          local quartoHiddenDivs = blocks:filter(isQuartoHiddenDiv)
          local sidebarBlocks = blocks:filter(isNotQuartoHiddenDiv)
          _, sidebarIdx = sidebarBlocks:find_if(isSidebar)
        
          -- slidebar at beginning
          if sidebarIdx == 1 then
            blocks = pandoc.List({ 
              sidebar, 
              pandoc.Div(tslice(sidebarBlocks, 2, #sidebarBlocks), pandoc.Attr("", { "panel-fill" }))
            })
            tappend(blocks, quartoHiddenDivs)
          -- sidebar at end
          elseif sidebarIdx == #sidebarBlocks then
            blocks = pandoc.List(
              { pandoc.Div(tslice(sidebarBlocks, 1, #sidebarBlocks-1), pandoc.Attr("", { "panel-fill" })), 
              sidebar 
            })
            tappend(blocks, quartoHiddenDivs)
          end
        end


        -- there are sidebars so we need to build a new list that folds together
        -- the sidebars with their adjacent layout blocks
        local rowClasses = {
          "grid", 
          "layout-sidebar",
          "ms-md-0"
        }
        local sidebarClasses = {
          "card",
          "bg-light",
          "p-2",
          "g-col-24",
          "g-col-lg-7"
        }
        local containerClasses = {
          "g-col-24",
          "g-col-lg-17",
          "pt-3",
          "pt-lg-0",
          "ps-0",
          "ps-lg-3"
        }
        local newBlocks = pandoc.List()
        local pendingSidebar = nil
        for i,el in ipairs(blocks) do 
          if isSidebar(el) then
            -- if the previous item is a container then wrap it up with the sidebar
            if #newBlocks > 0 and isContainer(newBlocks[#newBlocks]) then
              local container = newBlocks:remove(#newBlocks)
              tappend(container.attr.classes, containerClasses)
              tappend(el.attr.classes, sidebarClasses)
              newBlocks:insert(pandoc.Div({ container, sidebar }, pandoc.Attr("", rowClasses)))
            else 
              pendingSidebar = el
            end
          elseif pendingSidebar ~= nil and isContainer(el) then
            tappend(pendingSidebar.attr.classes, sidebarClasses)
            tappend(el.attr.classes, containerClasses)
            newBlocks:insert(pandoc.Div({ pendingSidebar, el }, pandoc.Attr("", rowClasses)))
            pendingSidebar = nil
          else
            if pendingSidebar ~= nil then
              newBlocks:insert(pendingSidebar)
              pendingSidebar = nil
            end
            newBlocks:insert(el)
          end
        end

        return newBlocks
      end
    end
  }
end
