

local kQuartoRawHtml = "quartoRawHtml"
local rawHtmlVars = pandoc.List()
local reactPreamble = pandoc.List()

local function addPreamble(preamble)
  if not reactPreamble:includes(preamble) then
    reactPreamble:insert(preamble)
  end
end

local function jsx(content)
  return pandoc.RawBlock("markdown", content)
end

function Pandoc(doc)
  -- insert exports at the top if we have them
  if #rawHtmlVars > 0 then
    local exports = ("export const %s =\n[%s];"):format(kQuartoRawHtml, 
      table.concat(
        rawHtmlVars:map(function(var) return '`\n'.. var .. '\n`' end), 
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
function Image(el)
  el.attr = pandoc.Attr()
  return el
end

-- header attributes only support id
function Header(el)
  el.attr = pandoc.Attr(el.identifier)
  return el
end

-- transform 'mdx' into passthrough content, transform 'html'
-- into raw commamark to pass through via dangerouslySetInnerHTML
function RawBlock(el)
  if el.format == 'mdx' then
    return pandoc.CodeBlock(el.text, pandoc.Attr("", {"mdx-code-block"}))
  elseif el.format == 'html' then
    -- track the raw html vars (we'll insert them at the top later on as
    -- mdx requires all exports be declared together)
    rawHtmlVars:insert(el.text)

    -- generate a div container for the raw html and return it as the block
    local html = ("<div dangerouslySetInnerHTML={{ __html: %s[%d] }} />")
      :format(kQuartoRawHtml, #rawHtmlVars-1) .. "\n"
    return pandoc.RawBlock("html", html)
  end
end



-- transform pandoc "title" to docusaures title. for code blocks
-- with no class, give them one so that they aren't plain 4 space indented
function CodeBlock(el)
  local lang = el.attr.classes[1]
  local title = el.attr.attributes["filename"] or el.attr.attributes["title"]  
  if lang and title then
    -- docusaures code block attributes don't conform to any syntax
    -- that pandoc natively understands, so return the CodeBlock as
    -- "raw" markdown (so it bypasses pandoc processing entirely)
    return pandoc.RawBlock("markdown", 
      "```" .. lang .. " title=\"" .. title .. "\"\n" ..
      el.text .. "\n```\n"
    )
  elseif #el.attr.classes == 0 then
    el.attr.classes:insert('text')
    return el
  end
end

-- transform quarto callout into docusaures admonition
function Div(el)
  -- handle callouts
  local callout = calloutType(el)
  if callout then
    -- return a list with the callout delimiters as raw markdown
    -- and the callout contents as ordinary ast elements
    local admonition = pandoc.List()
    admonition:insert(pandoc.RawBlock("markdown", ":::" .. callout))
    admonition:extend(el.content)
    admonition:insert(pandoc.RawBlock("markdown", ":::"))
    return admonition
  end
  -- handle tabsets
  if el.attr.classes:find("panel-tabset") then
    return tabset(el)
  end
end


function calloutType(div)
  for _, class in ipairs(div.attr.classes) do
    if isCallout(class) then 
      return class:match("^callout%-(.*)")
    end
  end
  return nil
end

function isCallout(class)
  return class == 'callout' or class:match("^callout%-")
end


-- based on native Tabset code from Quarto
-- (we can get rid of this when the extended AST is availlable)
---@param div pandoc.Div
function tabset(div)
 
  local heading = div.content[1]
  if heading ~= nil and heading.t == "Header" then
    
    -- note level
    local level = heading.level

    -- note groupId
    local groupId = ""
    local group = div.attributes["group"]
    if group then
      groupId = ([[ groupId="%s"]]):format(group)
    end
    
    -- create tabs
    local tabs = pandoc.Div({})
    tabs.content:insert(jsx("<Tabs" .. groupId .. ">"))
   
    -- iterate through content
    for i=1,#div.content do 
      local el = div.content[i]
      if el.t == "Header" and el.level == level then
        -- end previous tab
        if i > 1 then 
          tabs.content:insert(jsx("</TabItem>"))
        end
        -- start new tab
        tabs.content:insert(jsx(([[<TabItem value="%s">]]):format(pandoc.utils.stringify(el))))
      else
        -- append to current tab
        tabs.content:insert(el)
      end
    end

    -- end tab and tabset
    tabs.content:insert(jsx("</TabItem>"))
    tabs.content:insert(jsx("</Tabs>"))

    -- ensure we have required deps
    addPreamble("import Tabs from '@theme/Tabs';")
    addPreamble("import TabItem from '@theme/TabItem';")

    return tabs

  else
    return div
  end

end

