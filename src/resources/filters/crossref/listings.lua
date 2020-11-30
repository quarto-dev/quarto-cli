-- listings.lua
-- Copyright (C) 2020 by RStudio, PBC

-- process all listings
function listings()

  return {
    Blocks = function(blocks)

      local pendingCodeBlock = nil
      local targetBlocks = pandoc.List:new()

      -- process a listing
      function processListing(label, codeBlock, captionContent)

        -- the listing number
        local order = indexNextOrder("lst")

        if isLatexOutput() then

          -- add attributes to code block
          codeBlock.attr.identifier = label
          codeBlock.attr.classes:insert("listing")

          -- if we are use the listings package just add the caption
          -- attribute and return the block, otherwise generate latex
          if latexListings() then
            codeBlock.attributes["caption"] = pandoc.utils.stringify(
              pandoc.Span(captionContent)
            )
            targetBlocks:insert(codeBlock)
          else
            targetBlocks:insert(pandoc.RawBlock("latex", "\\begin{codelisting}"))
            local caption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
            caption.content:extend(captionContent)
            caption.content:insert(pandoc.RawInline("latex", "}"))
            targetBlocks:insert(caption)
            targetBlocks:insert(codeBlock)
            targetBlocks:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))
          end

          -- add the listing to the index
          indexAddEntry(label, nil, order, captionContent)

        else
          -- add the listing to the index
          indexAddEntry(label, nil, order, captionContent)

           -- Prepend the title
          tprepend(captionContent, listingTitlePrefix(order))

          -- add the list to the output blocks
          targetBlocks:insert(pandoc.Div(
            {
              pandoc.Para(captionContent),
              codeBlock
            },
            pandoc.Attr(label, {"listing"})
          ))
        end

      end

      for i, el in ipairs(blocks) do

        -- should we proceed with inserting this block?
        local insertBlock = true

        -- see if this is a code block with a listing label/caption
        if el.t == "CodeBlock" then

          if pendingCodeBlock then
            targetBlocks:insert(pendingCodeBlock)
            pendingCodeBlock = nil
          end

          local label = string.match(el.attr.identifier, "^lst:[^ ]+$")
          local caption = el.attr.attributes["caption"]
          if label and caption then
            processListing(label, el, markdownToInlines(caption))
          else
            pendingCodeBlock = el
          end

          insertBlock = false

        -- process pending code block
        elseif pendingCodeBlock then
          if isListingCaption(el) then

            -- find the label
            local lastInline = el.content[#el.content]
            local label = refLabel("lst", lastInline)

            -- remove the id from the end
            el.content = tslice(el.content, 1, #el.content-2)

            -- Slice off the colon and space
            el.content = tslice(el.content, 3, #el.content)

            -- process the listing
            processListing(label, pendingCodeBlock, el.content)

            insertBlock = false
          else
            targetBlocks:insert(pendingCodeBlock)
          end
          pendingCodeBlock = nil
        end

        -- either capture the code block or just emit the el
        if insertBlock then
          targetBlocks:insert(el)
        end
      end

      if pendingCodeBlock then
        targetBlocks:insert(pendingCodeBlock)
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
