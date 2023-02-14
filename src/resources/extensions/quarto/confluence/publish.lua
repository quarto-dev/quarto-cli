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

local function inlineOrInlinesToString(inlineOrInlinesValue)
  if(pandoc.utils.type(inlineOrInlinesValue) == "Inline") then
    local inlineElement = inlineOrInlinesValue
    return inlineElement.text or ""
  end

  if(pandoc.utils.type(inlineOrInlinesValue) == "Inlines") then
    local inlineElementList = inlineOrInlinesValue
    local result = ""
    for i = 1, #inlineElementList do
      if (inlineElementList[i].text) then
        result = result .. inlineElementList[i].text or ""
      end
    end
    return result;
  end
  return ""
end

function Writer (doc, opts)
  local filter ={
    Callout = function (callout)
      local renderString = confluence.CalloutConfluence(
              callout.type,
              pandoc.utils.stringify(callout.content))
      return pandoc.RawInline('html', renderString)
    end,
    Image = function (image)
      local renderString = confluence.CaptionedImageConfluence(
              image.src,
              image.title,
              pandoc.utils.stringify(image.caption),
              image.attributes)
      return pandoc.RawInline('html', renderString)
    end,
    Link = function (link)
      local content = inlineOrInlinesToString(link.content)
      local list = link.content
      local disableEscapeContents = #list > 0
      local renderString = confluence.LinkConfluence(
              content,
              link.target,
              link.title,
              link.attributes,
              disableEscapeContents)

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
    end,
    RawBlock = function (table)
      -- Raw blocks inclding arbirtary HTML like JavaScript is not supported in CSF
      return ""
    end
  }

  opts = opts or {}
  opts.wrap_text = "none"

  local result = quarto._quarto.ast.writer_walk(doc, filter)
  return pandoc.write(result, 'html', opts)
end