local confluence = require('overrides')

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

function log(label, object)
  print(label or '' .. ': ', dumpObject(object))
end


local function injectAnchor(element, addToFront)
  if(element and element.identifier and #element.identifier > 0) then
    local content = element.content
    -- Confluence HTML anchors are CSF macro snippets, inject into contents
    local anchor = pandoc.RawInline('html', confluence.HTMLAnchorConfluence(element.identifier))
    if (addToFront) then
      table.insert(content, 1, anchor)
    else
      table.insert(content, anchor)
    end
    element.content = content
  end
  return element
end

quarto._quarto.ast.add_renderer("Callout", function(_)
  return quarto._quarto.format.isConfluenceOutput()
end, function(callout)
  local renderedCalloutContent =
    pandoc.write(pandoc.Pandoc(callout.content), "html", { wrap_text = "none" })
  local renderString = confluence.CalloutConfluence(
          callout.type,
          renderedCalloutContent)
  return pandoc.RawInline('html', renderString)
end)

function Writer (doc, opts)
  local filter = {
    Image = function (image)
      local renderString = confluence.CaptionedImageConfluence(
              image.src,
              image.title,
              pandoc.utils.stringify(image.caption),
              image.attributes,
              image.identifier)
      result = pandoc.RawInline('html', renderString)
      return result
    end,
    Link = function (link)
      local renderedLinkContent =
        pandoc.write(pandoc.Pandoc(link.content), "html")

      source = renderedLinkContent

      local renderString = confluence.LinkConfluence(
              source,
              link.target,
              link.title,
              link.attributes)
      return pandoc.RawInline('html', renderString)
    end,
    Div = function (div)
      div = injectAnchor(div, true)
      return div
    end,
    CodeBlock = function (codeBlock)
      local renderString = confluence.CodeBlockConfluence(
              codeBlock.text,
              codeBlock.classes[1] or '')
      return pandoc.RawBlock('html', renderString)
    end,
    Table = function (table)
      -- Grid tables add a width style that widens the table, remove it
      table.attributes.style = ""
      local head = table.head
      local caption = table.caption.long

      -- Captions placed inside of the table will throw an error with CSF
      table.caption = {}
      return { table } .. caption
    end,
    Block = function (block)
      block = injectAnchor(block)
      return block
    end,
    RawBlock = function (rawBlock)
      -- We just "pass-through" raw blocks of type "confluence"
      if(rawBlock.format == 'confluence') then
        return pandoc.RawBlock('html', rawBlock.text)
      end

      -- Raw blocks including arbirtary HTML like JavaScript are not supported in CSF
      return ""
    end,
    RawInline = function (inline)
      local renderString = confluence.RawInlineConfluence(inline.text)
      return pandoc.RawInline('html', renderString)
    end
  }

  opts = opts or {}
  opts.wrap_text = "none"

  local result = quarto._quarto.ast.writer_walk(doc, filter)
  return pandoc.write(result, 'html', opts)
end
