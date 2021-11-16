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

        -- bail if there are no sidebars
        if not blocks:find_if(isSidebar) then
          return blocks
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
          "g-col-lg-6"
        }
        local containerClasses = {
          "g-col-24",
          "g-col-lg-18",
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
