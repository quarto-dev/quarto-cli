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

function dump(object, label)
  print(label or '' .. ': ', dumpObject(object))
end

function Writer (doc, opts)
  local filter = {
    Image = function (image)
      local renderString = confluence.CaptionedImageConfluence(
              image.src,
              image.title,
              pandoc.utils.stringify(image.caption),
              image.attributes)
      return pandoc.RawInline('html', renderString)
    end,
    Link = function (link)
      local renderString = confluence.LinkConfluence(
              pandoc.utils.stringify(link.content),
              link.target,
              link.title,
              link.attributes)
      return pandoc.RawInline('html', renderString)
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
    end
  }

  opts = opts or {}
  opts.wrap_text = "none"

  return pandoc.write(doc:walk(filter), 'html', opts)
end