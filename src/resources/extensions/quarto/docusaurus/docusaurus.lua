-- docusaurus.lua
-- Copyright (C) 2023 Posit Software, PBC

local kQuartoRawHtml = "quartoRawHtml"
local rawHtmlVars = pandoc.List()

function Pandoc(doc)
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
    local html = string.gsub(el.text, "\n+", "\n")
    rawHtmlVars:insert(html)

    -- generate a div container for the raw html and return it as the block
    local html = ("<div dangerouslySetInnerHTML={{ __html: %s[%d] }} />")
      :format(kQuartoRawHtml, #rawHtmlVars-1) .. "\n"
    return pandoc.RawBlock("html", html)
  end
end

