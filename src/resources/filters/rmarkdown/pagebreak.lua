--[[
pagebreak – convert raw LaTeX page breaks to other formats

Copyright © 2017-2019 Benct Philip Jonsson, Albert Krewinkel

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
]]
local stringify_orig = (require 'pandoc.utils').stringify

local function stringify(x)
  return type(x) == 'string' and x or stringify_orig(x)
end

--- configs – these are populated in the Meta filter.
local pagebreak = {
  epub = '<p style="page-break-after: always;"> </p>',
  html = '<div style="page-break-after: always;"></div>',
  latex = '\\newpage{}',
  ooxml = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
  odt = '<text:p text:style-name="Pagebreak"/>',
  context = '\\page'
}

local function pagebreaks_from_config (meta)
  local html_class =
    (meta.newpage_html_class and stringify(meta.newpage_html_class))
    or os.getenv 'PANDOC_NEWPAGE_HTML_CLASS'
  if html_class and html_class ~= '' then
    pagebreak.html = string.format('<div class="%s"></div>', html_class)
  end

  local odt_style =
    (meta.newpage_odt_style and stringify(meta.newpage_odt_style))
    or os.getenv 'PANDOC_NEWPAGE_ODT_STYLE'
  if odt_style and odt_style ~= '' then
    pagebreak.odt = string.format('<text:p text:style-name="%s"/>', odt_style)
  end
end

--- Return a block element causing a page break in the given format.
local function newpage(format)
  if format == 'docx' then
    return pandoc.RawBlock('openxml', pagebreak.ooxml)
  elseif format:match 'latex' then
    return pandoc.RawBlock('tex', pagebreak.latex)
  elseif format:match 'odt' then
    return pandoc.RawBlock('opendocument', pagebreak.odt)
  elseif format:match 'html.*' then
    return pandoc.RawBlock('html', pagebreak.html)
  elseif format:match 'epub' then
    return pandoc.RawBlock('html', pagebreak.epub)
  elseif format:match 'context' then
    return pandoc.RawBlock('context', pagebreak.context)
  else
    -- fall back to insert a form feed character
    return pandoc.Para{pandoc.Str '\f'}
  end
end

local function is_newpage_command(command)
  return command:match '^\\newpage%{?%}?$'
    or command:match '^\\pagebreak%{?%}?$'
end

-- Filter function called on each RawBlock element.
function RawBlock (el)
  -- Don't do anything if the output is TeX
  if FORMAT:match 'tex$' then
    return nil
  end
  -- check that the block is TeX or LaTeX and contains only
  -- \newpage or \pagebreak.
  if el.format:match 'tex' and is_newpage_command(el.text) then
    -- use format-specific pagebreak marker. FORMAT is set by pandoc to
    -- the targeted output format.
    return newpage(FORMAT)
  end
  -- otherwise, leave the block unchanged
  return nil
end

-- Turning paragraphs which contain nothing but a form feed
-- characters into line breaks.
function Para (el)
  if #el.content == 1 and el.content[1].text == '\f' then
    return newpage(FORMAT)
  end
end

return {
  {Meta = pagebreaks_from_config},
  {RawBlock = RawBlock, Para = Para}
}
