

function processTables(doc)


  filterDoc(doc, {

    Div = function(el)

      -- todo: don't allow div based tables in LATEX (messes w/ numbering)

      return el
    end,


    Table = function(el)

      if el.caption.long ~= nil then
        local last = el.caption.long[#el.caption.long]
        if #last.content > 2 then
          local lastInline = last.content[#last.content]
          local label = string.match(lastInline.text, "^{#(tbl:[^ }]+)}$")
          if label and last.content[#last.content-1].t == "Space" then
            -- remove the id from the end
            last.content = tslice(last.content, 1, #last.content-2)

            -- add the table to the index
            local order = indexNextOrder("tbl")
            indexAddEntry(label, nil, order, last.content)

            -- insert table caption (use \label for latex)
            if FORMAT == "latex" then
               tprepend(last.content, {
                 pandoc.RawInline('latex', '\\label{' .. label .. '}')
               })
            else
               tprepend(last.content, tableTitlePrefix(order))
            end

            -- wrap in a div with the label (so that we have a target
            -- for the tbl ref, in LaTeX that will be a hypertarget)
            return pandoc.Div(el, pandoc.Attr(label))
          end
        end
      end
      return el
    end
  })


end


function tableTitlePrefix(num)
  return titlePrefix("tbl", "Table", num)
end


