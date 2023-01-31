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
  dump(doc, 'doc')
  local filter = {
    Image = function (img)
      dump('Image')
      dump(img, 'img')
      dump(img.c, 'img.c')
      dump(img.attributes, 'img.attributes')
      dump(img.src, 'img.src')
      dump(img.title, 'img.title')
      dump(img.caption, 'img.caption')
      dump(img.caption[1] or '', 'img.caption[1]')
      dump(img.attr, 'img.attr')

      local renderString = confluence.CaptionedImageConfluence(
              img.src, img.title, 'Elephant', img.attr)
      dump(renderString, 'renderString')
      return pandoc.RawInline('html', renderString)
    end,
  }
  return pandoc.write(doc:walk(filter), 'html', opts)
end