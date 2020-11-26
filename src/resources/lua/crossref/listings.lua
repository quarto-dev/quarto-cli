-- TODO
-- probably shouldn't be stringifying the caption
-- issue w/ code block suppressed if the caption is the last block
-- consider more flexible listing captions (before/after, Listing: prefix)
-- latex listing missing padding at top of code chunk (compare with pandoc-crossref)
-- computational

function listings()

  return {
    Blocks = function(blocks)

      local codeBlock = nil
      local targetBlocks = pandoc.List:new()

      for i, el in ipairs(blocks) do

        -- process pending code block
        local processBlock = true
        if codeBlock then
          if isListingCaption(el) then

            -- find the label
            local lastInline = el.content[#el.content]
            local label = refLabel("lst", lastInline)

            -- remove the id from the end
            el.content = tslice(el.content, 1, #el.content-2)

            -- Slice off the colon
            el.content = tslice(el.content, 2, #el.content)

            -- the listing number
            local order = indexNextOrder("lst")

            if isLatexOutput() then

              -- slice off leading space, if any
              if el.content[1].t == "Space" then
                el.content = tslice(el.content, 2, #el.content)
              end

              -- add attributes to code block
              codeBlock.attr.identifier = label
              codeBlock.attr.classes:insert("listing")

              local caption = pandoc.utils.stringify(el)
              targetBlocks:insert(pandoc.RawBlock("latex", "\\begin{codelisting}"))
              targetBlocks:insert(pandoc.Plain({
                pandoc.RawInline("latex", "\\caption{"),
                pandoc.Str(caption),
                pandoc.RawInline("latex", "}")
              }))
              targetBlocks:insert(codeBlock)
              targetBlocks:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))

              -- add the listing to the index
              indexAddEntry(label, nil, order, el.content)
            else
              -- Prepend the title
              tprepend(el.content, listingTitlePrefix(order))

              -- add the listing to the index
              indexAddEntry(label, nil, order, el.content)

              -- add the list to the output blocks
              targetBlocks:insert(pandoc.Div({el, codeBlock}, pandoc.Attr(label, {"listing"})))
            end

            processBlock = false
          end
          codeBlock = nil
        end

        -- either capture the code block or just emit the el
        if processBlock then
          if (el.t == "CodeBlock") then
            codeBlock = el
          else
            targetBlocks:insert(el)
          end
        end
      end

      if codeBlock then
        targetBlocks:insert(codeBlock)
      end

      return targetBlocks
    end
  }
end

function listingTitlePrefix(num)
  return titlePrefix("lst", "Listing", num)
end

function prependTitlePrefix(caption, label, order)
  if isLatexOutput() then
     tprepend(caption.content, {
       pandoc.RawInline('latex', '\\label{' .. label .. '}')
     })
  else
     tprepend(caption.content, tableTitlePrefix(order))
  end
end


function isListingCaption(el)
  if el.t == "Para" then
    local contentStr = pandoc.utils.stringify(el)
    return string.find(contentStr, "^:%s+[^%s].*%s{#lst:[^ }]+}$")
  else
    return false
  end
end

function latexListings()
  return option("listings", false)
end


