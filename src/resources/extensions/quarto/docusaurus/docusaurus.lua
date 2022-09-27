

-- strip image attributes (which may result from
-- fig-format: retina) as they will result in an
-- img tag which won't hit the asset pipeline
function Image(el)
  el.attr = pandoc.Attr()
  return el
end

-- transform 'mdx' into passthrough content, transform 'html'
-- into raw commamark to pass through via dangerouslySetInnerHTML
local kQuartoRawHtml = "quartoRawHtml"
local rawHtmlVars = pandoc.List()
function RawBlock(el)
  if el.format == 'mdx' then
    el.format = 'html'
    return el
  elseif el.format == 'html' then
    -- track the raw html vars (we'll insert them at the top later on as
    -- mdx requires all exports be declared together)
    rawHtmlVars:insert(el.text)

    -- generate a div container for the raw html and return it as the block
    local html = ("<div dangerouslySetInnerHTML={{ __html: %s[%d] }} />")
      :format(kQuartoRawHtml, #rawHtmlVars-1)
    return pandoc.RawBlock("html", html)
  end
end

function Pandoc(doc)
  -- insert exports at the top if we have t hem
  if #rawHtmlVars > 0 then
    local exports = ("export const %s =\n[%s];"):format(kQuartoRawHtml, 
      table.concat(
        rawHtmlVars:map(function(var) return '`\n'.. var .. '\n`' end), 
        ","
      )
    )
    doc.blocks:insert(1, pandoc.RawBlock("commonmark", exports))
    return doc
  end

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

