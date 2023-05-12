-- listings.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("../modules/constants")

function isListingRef(identifier) 
  return string.match(identifier, "^lst%-[^ ]+$")
end

-- process all listings
function listings()
  
  return {
    DecoratedCodeBlock = function(node)
      local el = node.code_block
      local label = string.match(el.attr.identifier, "^lst%-[^ ]+$")
      local caption = el.attr.attributes[constants.kLstCap]
      if label and caption then
        -- the listing number
        local order = indexNextOrder("lst")
        
        -- generate content from markdown caption
        local captionContent = markdownToInlines(caption)

        -- add the listing to the index
        indexAddEntry(label, nil, order, captionContent)

        node.caption = captionContent
        node.order = order
        return node
      end
      return nil
    end,

    CodeBlock = function(el)
      local label = string.match(el.attr.identifier, "^lst%-[^ ]+$")
      local caption = el.attr.attributes[constants.kLstCap]
      if label and caption then
    
        -- the listing number
        local order = indexNextOrder("lst")
        
        -- generate content from markdown caption
        local captionContent = markdownToInlines(caption)
        
        -- add the listing to the index
        indexAddEntry(label, nil, order, captionContent)
       
        if _quarto.format.isLatexOutput() then

          -- add listing class to the code block
          el.attr.classes:insert("listing")

          -- if we are use the listings package we don't need to do anything
          -- further, otherwise generate the listing div and return it
          if not latexListings() then
            local listingDiv = pandoc.Div({})
            local env = "\\begin{codelisting}"
            if el.classes:includes('code-annotation-code') then
              env = env .. "[H]"
            end
            listingDiv.content:insert(pandoc.RawBlock("latex", env))
            local listingCaption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
            listingCaption.content:extend(captionContent)
            listingCaption.content:insert(pandoc.RawInline("latex", "}"))
            listingDiv.content:insert(listingCaption)
            listingDiv.content:insert(el)
            listingDiv.content:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))
            return listingDiv
          end

        else
         
           -- Prepend the title
          tprepend(captionContent, listingTitlePrefix(order))

          -- return a div with the listing
          return pandoc.Div(
            {
              pandoc.Para(captionContent),
              el
            },
            pandoc.Attr(label, {"listing"})
          )
        end

      end
      
      --  if we get this far then just reflect back the el
      return el
    end
  }

end

function listingTitlePrefix(order)
  return titlePrefix("lst", "Listing", order)
end


function latexListings()
  return param("listings", false)
end