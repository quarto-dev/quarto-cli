-- docusaurus.lua
-- Copyright (C) 2023 Posit Software, PBC

local kQuartoRawHtml = "quartoRawHtml"
local rawHtmlVars = pandoc.List()

local code_block = require('docusaurus_utils').code_block

local reactPreamble = pandoc.List()

local function addPreamble(preamble)
  if not reactPreamble:includes(preamble) then
    reactPreamble:insert(preamble)
  end
end

local function Pandoc(doc)
  -- insert exports at the top if we have them
  if #rawHtmlVars > 0 then
    local exports = ("export const %s =\n[%s];"):format(kQuartoRawHtml, 
      table.concat(
        rawHtmlVars:map(function(var) return '`'.. var .. '`' end), 
        ","
      )
    )
    doc.blocks:insert(1, pandoc.RawBlock("markdown", exports .. "\n"))
  end

  -- insert react preamble if we have it
  if #reactPreamble > 0 then
    local preamble = table.concat(reactPreamble, "\n")
    doc.blocks:insert(1, pandoc.RawBlock("markdown", preamble .. "\n"))
  end

  return doc
end

-- strip image attributes (which may result from
-- fig-format: retina) as they will result in an
-- img tag which won't hit the asset pipeline
local function Image(el)
  el.attr = pandoc.Attr()
  return el
end

-- header attributes only support id
local function Header(el)
  el.attr = pandoc.Attr(el.identifier)
  return el
end

-- transform 'mdx' into passthrough content, transform 'html'
-- into raw commamark to pass through via dangerouslySetInnerHTML
local function RawBlock(el)
  if el.format == 'mdx' then
    -- special mdx-code-block is not handled if whitespace is present after backtrick (#8333)
    return pandoc.RawBlock("markdown", "````mdx-code-block\n" .. el.text .. "\n````")
  elseif el.format == 'html' then
    -- track the raw html vars (we'll insert them at the top later on as
    -- mdx requires all exports be declared together)
    local html = string.gsub(el.text, "\n+", "\n")
    rawHtmlVars:insert(html)

    -- generate a div container for the raw html and return it as the block
    local html = ("<div dangerouslySetInnerHTML={{ __html: %s[%d] }} />")
      :format(kQuartoRawHtml, #rawHtmlVars-1) .. "\n"
    return pandoc.RawBlock("html", html)
  end
end

local function DecoratedCodeBlock(node)
  local el = node.code_block
  return code_block(el, node.filename)
end

local function CodeBlock(el)
  return code_block(el, el.attr.attributes["filename"])
end

local function jsx(content)
  return pandoc.RawBlock("markdown", content)
end

local function tabset(node)
  -- note groupId
  local groupId = ""
  local group = node.attr.attributes["group"]
  if group then
    groupId = ([[ groupId="%s"]]):format(group)
  end
  
  -- create tabs
  local tabs = pandoc.Div({})
  tabs.content:insert(jsx("<Tabs" .. groupId .. ">"))
  
  -- iterate through content
  for i=1,#node.tabs do 
    local content = node.tabs[i].content
    local title = node.tabs[i].title

    tabs.content:insert(jsx(([[<TabItem value="%s">]]):format(pandoc.utils.stringify(title))))
    if type(content) == "table" then
      tabs.content:extend(content)
    else
      tabs.content:insert(content)
    end
    tabs.content:insert(jsx("</TabItem>"))
  end

  -- end tab and tabset
  tabs.content:insert(jsx("</Tabs>"))

  -- ensure we have required deps
  addPreamble("import Tabs from '@theme/Tabs';")
  addPreamble("import TabItem from '@theme/TabItem';")

  return tabs
end

quarto._quarto.ast.add_renderer("Tabset", function()
  return quarto._quarto.format.isDocusaurusOutput()
end, function(node)
  return tabset(node)
end)

quarto._quarto.ast.add_renderer("Callout", function()
  return quarto._quarto.format.isDocusaurusOutput()
end, function(node)
  local admonition = pandoc.Blocks({})
  admonition:insert(pandoc.RawBlock("markdown", "\n:::" .. node.type))
  if node.title then
    admonition:insert(pandoc.Header(2, node.title))
  end
  local content = node.content
  if type(content) == "table" then
    admonition:extend(content)
  else
    admonition:insert(content)
  end
  admonition:insert(pandoc.RawBlock("markdown", ":::\n"))
  return admonition
end)

quarto._quarto.ast.add_renderer("DecoratedCodeBlock", function()
  return quarto._quarto.format.isDocusaurusOutput()
end, function(node)
  local el = node.code_block
  return code_block(el, node.filename)
end)

return {
  {
    traverse = "topdown",
    Image = Image,
    Header = Header,
    RawBlock = RawBlock,
    DecoratedCodeBlock = DecoratedCodeBlock,
    CodeBlock = CodeBlock,
  },
  {
    Pandoc = Pandoc,
  }
}