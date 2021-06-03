-- panel-sidebar.lua
-- Copyright (C) 2021 by RStudio, PBC


function panelSidebar() 
  return {
    Blocks = function(blocks)
      if hasBootstrap() then
        -- see if there is a sidebar
        local sidebarLeft = false
        local sidebar = nil
        local mainPanel = pandoc.List:new()
        for i,el in ipairs(blocks) do 
          if sidebar == nil and el.t == "Div" and el.attr.classes:find("panel-sidebar") then
            sidebar = el
            sidebarLeft = i == 1
          else
            mainPanel:insert(el)
          end
        end

        -- if there is a sidebar then cleave up the div as appropriate
        if sidebar then

          -- add std sidebar classes
          tappend(sidebar.attr.classes, {
            "card",
            "bg-light",
            "p-2",
            "col",
            "col-12",
            "col-lg-3"
          })

          local row = pandoc.Div({}, pandoc.Attr("", { 
            "row", 
            "layout-sidebar",
            "ms-md-0", 
            "m-1" 
          }))
          if sidebarLeft then
            row.content:insert(sidebar)
          end
          row.content:insert(pandoc.Div(mainPanel, pandoc.Attr("", {
            "col",
            "col-12",
            "col-lg-9",
            "pt-3",
            "pt-lg-0",
            "ps-0",
            "ps-lg-3"
          })))
          if not sidebarLeft then
            row.content:insert(sidebar)
          end

          return pandoc.List({ row })
        end
      end

      -- failsafe
      return blocks

    end
  }
end
