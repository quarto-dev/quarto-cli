-- Confluence Storage Format for Pandoc
-- https://confluence.atlassian.com/doc/confluence-storage-format-790796544.html
-- https://pandoc.org/MANUAL.html#custom-readers-and-writers
local function startsWith(text, prefix)
  return text:find(prefix, 1, true) == 1
end

local function escape(s, in_attribute)
  return s:gsub("[<>&\"']",
          function(x)
            if x == '<' then
              return '&lt;'
            elseif x == '>' then
              return '&gt;'
            elseif x == '&' then
              return '&amp;'
            elseif in_attribute and x == '"' then
              return '&quot;'
            elseif in_attribute and x == "'" then
              return '&#39;'
            else
              return x
            end
          end)
end

-- From https://stackoverflow.com/questions/9168058/how-to-dump-a-table-to-console
function dumpObject(o)
  if type(o) == 'table' then
    local s = '{ '
    for k,v in pairs(o) do
      if type(k) ~= 'number' then k = '"'..k..'"' end
      s = s .. '['..k..'] = ' .. dumpObject(v) .. ','
    end
    return s .. '} '
  else
    return tostring(o)
  end
end

function dump(object, label)
  print(label or '' .. ': ', dumpObject(object))
end

local function isEmpty(s)
  return s == nil or s == ''
end

-- from http://lua-users.org/wiki/StringInterpolation
local interpolate = function(str, vars)
  -- Allow replace_vars{str, vars} syntax as well as replace_vars(str, {vars})
  if not vars then
    vars = str
    str = vars[1]
  end
  return (string.gsub(str, "({([^}]+)})",
          function(whole, i)
            return vars[i] or whole
          end))
end

function CaptionedImageConfluence(source, title, caption, attr)
  --Note Title isn't usable by confluence at this time it will
  -- serve as the default value for attr.alt-text

  local CAPTION_SNIPPET = [[<ac:caption>
            <p>{caption}</p>
        </ac:caption>]]

  local IMAGE_SNIPPET = [[<ac:image
    ac:align="{align}"
    ac:layout="{layout}"
    ac:alt="{alt}">
        <ri:attachment ri:filename="{source}" />{caption}
    </ac:image>]]

  local sourceValue = escape(source, true)
  local titleValue = escape(title, true)
  local captionValue = escape(caption)

  local alignValue = 'center'
  if (attr and attr['fig-align']) then
    alignValue = escape(attr['fig-align'], 'center')
  end

  local altValue = titleValue;
  if (attr and attr['fig-alt']) then
    altValue = escape(attr['fig-alt'], '')
  end

  local layoutValue = 'center'
  if alignValue == 'right' then layoutValue = 'align-end' end
  if alignValue == 'left' then layoutValue = 'align-start' end

  if not isEmpty(captionValue) then
    captionValue =
    interpolate {CAPTION_SNIPPET, caption = captionValue}
  end
  return interpolate {
    IMAGE_SNIPPET,
    source = sourceValue,
    align = alignValue,
    layout = layoutValue,
    alt = altValue,
    caption = captionValue}
end

function LinkConfluence(source, target, title, attr)
  local LINK_ATTACHMENT_SNIPPET = [[<ac:link><ri:attachment ri:filename="{source}"/><ac:plain-text-link-body><![CDATA[{target}{doubleBraket}></ac:plain-text-link-body></ac:link>]]
  if(not startsWith(target,"http") and (not string.find(target, ".qmd"))) then
    return interpolate {
    LINK_ATTACHMENT_SNIPPET,
    source = source,
    target = target,
    doubleBraket = "]]"
  }
  end

    return "<a href='" .. escape(target,true) .. "' title='" ..
            escape(title,true) .. "'>" .. source .. "</a>"
end

function CodeBlockConfluence(codeValue, attributes)
  local languageValue = attributes and attributes.class or ''
  local CODE_SNIPPET = [[<ac:structured-macro
      ac:name="code"
      ac:schema-version="1"
      ac:macro-id="1d1a2d13-0179-4d8f-b448-b28dfaceea4a">
        <ac:parameter ac:name="language">{languageValue}</ac:parameter>
        <ac:plain-text-body>
          <![CDATA[{codeValue}{doubleBraket}>
        </ac:plain-text-body>
    </ac:structured-macro>]]

  return interpolate {
    CODE_SNIPPET,
    languageValue = languageValue,
    codeValue = codeValue,
    doubleBraket = ']]'
  }
end

-- Convert pandoc alignment to something HTML can use.
-- align is AlignLeft, AlignRight, AlignCenter, or AlignDefault.
local function html_align(align)
  if align == 'AlignLeft' then
    return 'left'
  elseif align == 'AlignRight' then
    return 'right'
  elseif align == 'AlignCenter' then
    return 'center'
  else
    return 'left'
  end
end

-- Caption is a string, aligns is an array of strings,
-- widths is an array of floats, headers is an array of
-- strings, rows is an array of arrays of strings.
function TableConfluence(caption, aligns, widths, headers, rows)
  --dump(caption, 'caption')
  --dump(aligns, 'aligns')
  --dump(widths, 'widths')
  --dump(headers, 'headers')
  --dump(rows, 'rows')

  local buffer = {}
  local function add(s)
    table.insert(buffer, s)
  end
  add("<table>")
  if widths and widths[1] ~= 0 then
    add("<colgroup>")
    -- extract with test and put a colgroup here
    for _, w in pairs(widths) do
      add('<col width="' .. string.format("%.0f%%", w * 100) .. '" />')
    end
    add("</colgroup>")
  end
  local header_row = {}
  local empty_header = true
  for i, h in pairs(headers) do
    local align = html_align(aligns[i])
    table.insert(header_row,
            '<th align="' ..
                    align ..
                    '">' ..
                    '<p style="text-align: ' ..
                    html_align(aligns[i]) ..
                    ';">' ..
                    h ..
                    '</p>' ..
                    '</th>')
    empty_header = empty_header and h == ""
  end
  if empty_header then
    head = ""
  else
    add('<tr class="header">')
    for _,h in pairs(header_row) do
      add(h)
    end
    add('</tr>')
  end
  local class = "even"
  for _, row in pairs(rows) do
    class = (class == "even" and "odd") or "even"
    add('<tr class="' .. class .. '">')
    for i,c in pairs(row) do
      add('<td align="' ..
              html_align(aligns[i]) ..
              '">' ..
              '<p style="text-align: ' ..
              html_align(aligns[i]) ..
              ';">' ..
              c ..
              '</p>' ..
              '</td>')
    end
    add('</tr>')
  end
  add('</table>')
  if caption ~= "" then
    add("<p>" .. caption .. "</p>")
  end
  return table.concat(buffer,'\n')
end

function BlockQuoteConfluence(source)
  return "<blockquote>" .. source .. "</blockquote>"
end

return {
  CaptionedImageConfluence = CaptionedImageConfluence,
  CodeBlockConfluence = CodeBlockConfluence,
  LinkConfluence = LinkConfluence,
  TableConfluence = TableConfluence,
  BlockQuoteConfluence = BlockQuoteConfluence,
  escape = escape,
  html_align = html_align,
  interpolate = interpolate
}