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
    Image = function (img)
      local renderString = confluence.CaptionedImageConfluence(
              img.src, img.title, 'Elephant', img.attr)
      dump(renderString, 'renderString')
      return pandoc.RawInline('html', renderString)
    end,
  }
  return pandoc.write(doc:walk(filter), 'html', opts)
end