

-- strip image attributes (which may result from
-- fig-format: retina) as they will result in an
-- img tag which won't hit the asset pipeline
function Image(el)
  el.attr = pandoc.Attr()
  return el
end

-- transform pandoc "title" to docusaures title
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
  end
end

-- transform quarto callout into docusaures admonition
function Div(el)
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

