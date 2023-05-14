-- panel-tabset.lua
-- Copyright (C) 2022 Posit Software, PBC

---@alias quarto.Tab { content:pandoc.Blocks, title:pandoc.Inlines }

--[[
Create a Tab AST node (represented as a Lua table)
]]
---@param params { content:nil|pandoc.Blocks|string, title:pandoc.Inlines|string }
---@return quarto.Tab
quarto.Tab = function(params)
  local content
  if type(params.content) == "string" then
    local content_string = params.content
    ---@cast content_string string
    content = pandoc.Blocks(pandoc.read(content_string, "markdown").blocks)
  else
    content = params.content or pandoc.Blocks({})
  end
  return {
    content = content,
    title = pandoc.Inlines(params.title)
  }
end

local function render_quarto_tab(tbl, tabset)
  local content = quarto.utils.as_blocks(tbl.content)
  local title = quarto.utils.as_inlines(tbl.title)
  local inner_content = pandoc.List()
  inner_content:insert(pandoc.Header(tabset.level, title))
  inner_content:extend(content)
  return pandoc.Div(inner_content)
end

function parse_tabset_contents(div)
  local heading = div.content:find_if(function(el) return el.t == "Header" end)
  if heading ~= nil then
    -- note the level, then build tab buckets for content after these levels
    local level = heading.level
    local tabs = pandoc.List()
    local tab = nil
    for i=1,#div.content do 
      local el = div.content[i]
      if el.t == "Header" and el.level == level then
        tab = quarto.Tab({ title = el.content })
        tabs:insert(tab)
      elseif tab ~= nil then
        tab.content:insert(el)
      end
    end
    return tabs, level
  else
    return nil
  end
end

local tabsetidx = 1

function render_tabset(attr, tabs, renderer)
  -- create a unique id for the tabset
  local tabsetid = "tabset-" .. tabsetidx
  tabsetidx = tabsetidx + 1

  -- init tab navigation 
  local nav = pandoc.List()
  nav:insert(pandoc.RawInline('html', '<ul ' .. renderer.ulAttribs(tabsetid) .. '>'))

  -- init tab panes
  local panes = pandoc.Div({}, attr)
  panes.attr.classes = attr.classes:map(function(class) 
    if class == "panel-tabset" then
      return "tab-content" 
    else
      return class
    end
  end)
  
  -- populate
  for i=1,#tabs do
    -- alias tab and heading
    local tab = tabs[i]
    local heading = tab.content[1]
    tab.content:remove(1)

    -- tab id
    local tabid = tabsetid .. "-" .. i
    local tablinkid = tabid .. "-tab" -- FIXME unused from before?

    -- navigation
    nav:insert(pandoc.RawInline('html', '<li ' .. renderer.liAttribs() .. '>'))
    nav:insert(pandoc.RawInline('html', '<a ' .. renderer.liLinkAttribs(tabid, i==1) .. '>'))
    nav:extend(heading.content)
    nav:insert(pandoc.RawInline('html', '</a></li>'))

    -- pane
    local paneAttr = renderer.paneAttribs(tabid, i==1, heading.attr)
    local pane = pandoc.Div({}, paneAttr)
    pane.content:extend(tab.content)
    panes.content:insert(pane)
  end

  -- end tab navigation
  nav:insert(pandoc.RawInline('html', '</ul>'))

  -- return tabset
  return pandoc.Div({
    pandoc.Plain(nav),
    panes
  }, attr:clone())
end

_quarto.ast.add_handler({
  -- use either string or array of strings
  class_name = { "panel-tabset" },

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "Tabset",

  kind = "Block",

  constructor = function(params)
    local node = _quarto.ast.create_custom_node_scaffold("Tabset", "Block")

    local custom_data = {
      __quarto_custom_node = node,
      level = params.level or 2,
      attr = params.attr or pandoc.Attr(),
    }

    local function make_tab_metaobject(custom_data, index)
      local forwarder = {
        content = 2 * index - 1,
        title = 2 * index
      }
      local result = {}
      setmetatable(result, _quarto.ast.create_proxy_metatable(
        function(key) return forwarder[key] end,
        function(_) 
          return custom_data["__quarto_custom_node"] 
        end
      ))
      return result
    end

    local function make_tabs_metaobject(custom_data)
      local result = {
      }
      setmetatable(result, {
        __pairs = function(t)
          local l = #custom_data["__quarto_custom_node"].content // 2
          return function(t, k)
            local key = k + 1
            if key > l then
              return nil
            end
            return key, make_tab_metaobject(t, key)
          end, t, 0
        end,
        __len = function(t)
          return #custom_data["__quarto_custom_node"].content // 2
        end,
        __index = function(t, k)
          if k == "__quarto_custom_node" then
            return custom_data["__quarto_custom_node"]
          end
          if type(k) ~= "number" then
            return rawget(t, k)
          end
          local l = #custom_data["__quarto_custom_node"].content // 2
          if k < 1 or k > l then
            return nil
          end
          return make_tab_metaobject(t, k)
        end,
        __newindex = function(t, k, v)
          if type(k) ~= "number" then
            rawset(t, k, v)
            return
          end
          local tab = make_tab_metaobject(custom_data, k)
          for key, value in pairs(v) do
            tab[key] = value
          end
        end
      })
      return result
    end

    setmetatable(custom_data, {
      __index = function(t, k)
        if k ~= "tabs" then
          return rawget(t, k)
        end
        return make_tabs_metaobject(t)
      end,
      __newindex = function(t, k, v)
        if k ~= "tabs" then
          rawset(t, k, v)
          return
        end
        local tabs = make_tabs_metaobject(t)
        for key, value in pairs(v) do
          tabs[key] = value
        end
      end
    })
    custom_data.tabs = params.tabs or pandoc.List()

    return custom_data, false
  end,

  -- a function that takes the div node as supplied in user markdown
  -- and returns the custom node
  parse = function(div)
    local tabs, level = parse_tabset_contents(div)
    return quarto.Tabset({
      level = level,
      tabs = tabs,
      attr = div.attr
    })
  end,

  -- a function that renders the extendedNode into output
  render = function(node)
    local tabs = tmap(node.tabs, function(tab) return render_quarto_tab(tab, node) end)
    if hasBootstrap() then
      return render_tabset(node.attr, tabs, bootstrapTabs())
    elseif _quarto.format.isHtmlOutput() then
      return render_tabset(node.attr, tabs, tabbyTabs())
    elseif _quarto.format.isLatexOutput() or _quarto.format.isDocxOutput() or _quarto.format.isEpubOutput() or _quarto.format.isJatsOutput() then
      return pandoc.Div(render_tabset_with_l4_headings(tabs), node.attr)
    else
      print("Warning: couldn't recognize format, using default tabset rendering")
      return pandoc.Div(render_tabset_with_l4_headings(tabs), node.attr)
    end  
  end,

  -- -- a function that takes the extended node and
  -- -- returns a table with walkable attributes (pandoc nodes, Inlines, Blocks)
  -- -- that represent inner content that should
  -- -- be visible to filters.
  -- inner_content = function(extended_node)
  --   local result = {}

  --   for i=1,#extended_node.tabs do
  --     result[i * 2 - 1] = extended_node.tabs[i].content
  --     result[i * 2] = extended_node.tabs[i].title
  --   end
  --   return result
  -- end,

  -- -- a function that updates the extended node
  -- -- with new inner content (as returned by filters)
  -- -- table keys are a subset of those returned by inner_content
  -- -- and represent changed values that need to be updated.    
  -- set_inner_content = function(extended_node, values)
  --   for k, v in pairs(values) do
  --     local tab = ((k - 1) // 2) + 1
  --     local key = ((k % 2 == 0) and "title") or "content"
  --     extended_node.tabs[tab][key] = v
  --   end
  -- end
})

-- function tabsetDiv(div, renderer)

--   -- create a unique id for the tabset
--   local tabsetid = "tabset-" .. tabsetidx
--   tabsetidx = tabsetidx + 1

--   -- find the first heading in the tabset
--   local heading = div.content:find_if(function(el) return el.t == "Header" end)
--   if heading ~= nil then
--     -- note the level, then build tab buckets for content after these levels
--     local level = heading.level
--     local tabs = pandoc.List()
--     local tab = nil
--     for i=1,#div.content do 
--       local el = div.content[i]
--       if el.t == "Header" and el.level == level then
--         tab = pandoc.Div({})
--         tab.content:insert(el)
--         tabs:insert(tab)
--       elseif tab ~= nil then
--         tab.content:insert(el)
--       end
--     end

--     -- init tab navigation 
--     local nav = pandoc.List()
--     nav:insert(pandoc.RawInline('html', '<ul ' .. renderer.ulAttribs(tabsetid) .. '>'))

--     -- init tab panes
--     local panes = pandoc.Div({}, div.attr)
--     panes.attr.classes = div.attr.classes:map(function(class) 
--       if class == "panel-tabset" then
--         return "tab-content" 
--       else
--         return class
--       end
--     end)
   
--     -- populate
--     for i=1,#tabs do
--       -- alias tab and heading
--       local tab = tabs[i]
--       local heading = tab.content[1]
--       tab.content:remove(1)

--       -- tab id
--       local tabid = tabsetid .. "-" .. i
--       local tablinkid = tabid .. "-tab"

--       -- navigation
--       nav:insert(pandoc.RawInline('html', '<li ' .. renderer.liAttribs() .. '>'))
--       nav:insert(pandoc.RawInline('html', '<a ' .. renderer.liLinkAttribs(tabid, i==1) .. '>'))
--       nav:extend(heading.content)
--       nav:insert(pandoc.RawInline('html', '</a></li>'))

--       -- pane
--       local paneAttr = renderer.paneAttribs(tabid, i==1, heading.attr)
--       local pane = pandoc.Div({}, paneAttr)
--       pane.content:extend(tab.content)
--       panes.content:insert(pane)
--     end

--     -- end tab navigation
--     nav:insert(pandoc.RawInline('html', '</ul>'))

--     -- return tabset
--     return pandoc.Div({
--       pandoc.Plain(nav),
--       panes
--     }, div.attr:clone())

--   end 
-- end

function bootstrapTabs() 
  return {
    ulAttribs = function(tabsetid)
      return 'class="nav nav-tabs" role="tablist"'
    end,
    liAttribs = function(tabid, isActive)
      return 'class="nav-item" role="presentation"'
    end,
    liLinkAttribs = function(tabid, isActive)
      local tablinkid = tabid .. "-tab"
      local active = ""
      local selected = "false"
      if isActive then
        active = " active"
        selected = "true"
      end
      return 'class="nav-link' .. active .. '" id="' .. tablinkid .. '" data-bs-toggle="tab" data-bs-target="#' .. tabid .. '" role="tab" aria-controls="' .. tabid .. '" aria-selected="' .. selected .. '"'
    end,
    paneAttribs = function(tabid, isActive, headingAttribs)
      local tablinkid = tabid .. "-tab"
      local attribs = headingAttribs:clone()
      attribs.identifier = tabid
      attribs.classes:insert("tab-pane")
      if isActive then
        attribs.classes:insert("active")
      end
      attribs.attributes["role"] = "tabpanel"
      attribs.attributes["aria-labelledby"] = tablinkid
      return attribs
    end
  }
end

function tabbyTabs()
  return {
    ulAttribs = function(tabsetid)
      return 'id="' .. tabsetid .. '" class="panel-tabset-tabby"'
    end,
    liAttribs = function(tabid, isActive)
      return ''
    end,
    liLinkAttribs = function(tabid, isActive)
      local default = ""
      if isActive then
        default = "data-tabby-default "
      end
      return default .. 'href="#' .. tabid .. '"'
    end,
    paneAttribs = function(tabid, isActive, headingAttribs)
      local attribs = headingAttribs:clone()
      attribs.identifier = tabid
      return attribs
    end
  }
end

local function min(a, b)
  if a < b then
    return a
  else
    return b
  end
end

function render_tabset_with_l4_headings(tabs)
  local result = pandoc.List()
  for i=1,#tabs do
    local tab = tabs[i]
    local heading = tab.content[1]
    local level = heading.level
    tab.content:remove(1)
    local tabid = "tab-" .. i
    result:insert(pandoc.Header(min(4, level), heading.content, heading.attr))
    result:extend(tab.content)
  end
  return result
end

-- function tabsetLatex(div_content)
--   -- find the first heading in the tabset
--   local heading = div_content:find_if(function(el) return el.t == "Header" end)
--   if heading ~= nil then
--     local level = heading.level
--     if level < 4 then
--       heading.level = 4

--       for i=1,#div_content do 
--         local el = div_content[i]
--         if el.t == "Header" and el.level == level then
--           el.level = 4
--         end
--       end 
--     end
--   end

--   return div_content
-- end