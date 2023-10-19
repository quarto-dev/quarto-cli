-- panel-sidebar.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function bootstrap_panel_sidebar() 
  return {
    Blocks = function(blocks)
      if hasBootstrap() or _quarto.format.isRevealJsOutput() then

        -- functions to determine if an element has a layout class
        local function isSidebar(el)
          return el ~= nil and el.t == "Div" and el.attr.classes:includes("panel-sidebar")
        end
        local function isTabset(el) return is_custom_node(el, "Tabset") end
        local function fillPanel(el) return pandoc.Div({ el }, pandoc.Attr("", {"panel-fill"})) end
        local function isContainer(el)
          return el ~= nil and
                 el.t == "Div" and 
                 (el.attr.classes:includes("panel-fill") or 
                  el.attr.classes:includes("panel-center") or
                  isTabset(el))
        end
        local function isHeader(el)
          return el ~= nil and el.t == "Header"
        end
        local function isQuartoHiddenDiv(el)
          return el ~= nil and el.t == "Div" and
                 string.find(el.attr.identifier, "^quarto%-") and
                 el.attr.classes:includes("hidden")
        end
        local function isNotQuartoHiddenDiv(el)
          return not isQuartoHiddenDiv(el)
        end

        -- bail if there are no sidebars
        local sidebar, sidebarIdx = blocks:find_if(isSidebar)
        if not sidebar then
          return blocks
        end

        -- create sidebar handler and get attr
        local sidebarHandler = bootstrapSidebar()
        if _quarto.format.isRevealJsOutput() then
          sidebarHandler = revealSidebar()
        end
        local sidebarAttr = sidebarHandler.sidebarAttr()
        local containerAttr = sidebarHandler.containerAttr()
    
        -- filter out quarto hidden blocks (they'll get put back in after processing)
        local quartoHiddenDivs = blocks:filter(isQuartoHiddenDiv)
        blocks = blocks:filter(isNotQuartoHiddenDiv)

        -- locate and arrange sidebars until there are none left
        local sidebar, sidebarIdx = blocks:find_if(isSidebar)
       
        while sidebar ~= nil and sidebarIdx ~= nil do

          -- always transfer sidebar attributes to sidebar
          transferAttr(sidebarAttr, sidebar.attr)

          -- sidebar after container
          if isContainer(blocks[sidebarIdx - 1]) then
            blocks:remove(sidebarIdx)
            local container = blocks:remove(sidebarIdx - 1)
            if isTabset(container) then
              container = fillPanel(container)
            end
            transferAttr(containerAttr, container.attr)
            blocks:insert(sidebarIdx - 1, 
              pandoc.Div({ container, sidebar }, sidebarHandler.rowAttr({"layout-sidebar-right"}))
            )
          -- sidebar before container
          elseif isContainer(blocks[sidebarIdx + 1]) then
            local container = blocks:remove(sidebarIdx + 1)
            if isTabset(container) then
              container = fillPanel(container)
            end
            transferAttr(containerAttr, container.attr)
            blocks:remove(sidebarIdx)
            blocks:insert(sidebarIdx, 
              pandoc.Div({ sidebar, container }, sidebarHandler.rowAttr({"layout-sidebar-left"}))
            )
          else
            -- look forward for a header
            local header, headerIdx = blocks:find_if(isHeader, sidebarIdx)
            if header and headerIdx and (headerIdx ~= (sidebarIdx + 1)) then
              local panelBlocks = pandoc.List()
              for i = sidebarIdx + 1, headerIdx - 1, 1 do
                panelBlocks:insert(blocks:remove(sidebarIdx + 1))
              end
              local panelFill = pandoc.Div(panelBlocks, pandoc.Attr("", { "panel-fill" }))
              transferAttr(containerAttr, panelFill)
              blocks:remove(sidebarIdx)
              blocks:insert(sidebarIdx, 
                pandoc.Div({ sidebar,  panelFill }, sidebarHandler.rowAttr({"layout-sidebar-left"}))
              )
            else
              -- look backwards for a header 
              
              headerIdx = nil
              for i = sidebarIdx - 1, 1, -1 do
                if isHeader(blocks[i]) then
                  headerIdx = i
                  break
                end
              end
              -- if we have a header then collect up to it
              if headerIdx ~= nil and (headerIdx ~= (sidebarIdx - 1)) then
                local panelBlocks = pandoc.List()
                for i = headerIdx + 1, sidebarIdx - 1, 1 do
                  panelBlocks:insert(blocks:remove(headerIdx + 1))
                end
                local panelFill = pandoc.Div(panelBlocks,  pandoc.Attr("", { "panel-fill" }))
                transferAttr(containerAttr, panelFill)
                blocks:remove(headerIdx + 1)
                blocks:insert(headerIdx + 1, 
                  pandoc.Div({ panelFill, sidebar }, sidebarHandler.rowAttr({"layout-sidebar-right"}))
                )
              else
                --  no implicit header containment found, strip the sidebar attribute
                sidebar.attr.classes = sidebar.attr.classes:filter(
                  function(clz) 
                    return clz ~= "panel-sidebar" and clz ~= "panel-input"
                  end
                )
              end
            end
          end

          -- try to find another sidebar
          sidebar, sidebarIdx = blocks:find_if(isSidebar)
        end

        -- restore hidden divs and return blocks
        tappend(blocks, quartoHiddenDivs)
        return blocks
      end
    end
  }
end

function bootstrapSidebar()
  return {
    rowAttr = function(classes)
      local attr = pandoc.Attr("", {
        "panel-grid", 
        "layout-sidebar",
        "ms-md-0"
      })
      tappend(attr.classes, classes)
      return attr
    end,
    sidebarAttr = function()
      return pandoc.Attr("", {
        "card",
        "bg-light",
        "p-2",
        "g-col-24",
        "g-col-lg-7"
      })
    end,
    containerAttr = function()
      return pandoc.Attr("", {
        "g-col-24",
        "g-col-lg-17",
        "pt-3",
        "pt-lg-0",
      })
    end
  }
end

function revealSidebar()
  return {
    rowAttr = function(classes) 
      local attr = pandoc.Attr("", { "layout-sidebar" })
      tappend(attr.classes, classes)
      return attr
    end,
    sidebarAttr = function()
      local attr = pandoc.Attr("", {})
      return attr
    end,
    containerAttr = function()
      return pandoc.Attr("")
    end
  }
end

function transferAttr(from, to)
  tappend(to.classes, from.classes)
  for k,v in pairs(from.attributes) do
    to.attributes[k] = v
  end
end