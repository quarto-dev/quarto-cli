
-- slice elements out of a table
-- TODO: Move to _quarto.utils.table.slice
local function tslice(t, first, last, step)
  local sliced = {}
  for i = first or 1, last or #t, step or 1 do
    sliced[#sliced+1] = t[i]
  end
  return sliced
end


local function makeCard(title, contents, classes)
  local titleDiv = pandoc.Div(title.content, pandoc.Attr("", {"card-header"}))
  local contentDiv = pandoc.Div(contents, pandoc.Attr("", {"card-body"}))
  local clz = pandoc.List({"card"})
  if classes then
    clz:extend(classes)
  end
  
  return pandoc.Div({titleDiv, contentDiv}, pandoc.Attr("", clz))
end


function render_dashboard() 

  -- only do this for dashboad output
  if not _quarto.format.isDashboardOutput() then
    return {}
  end
  return {
    {
      Pandoc = function(el)
        -- Make sections based upon the headings and use that for the 
        -- document structure
        local opts = PANDOC_WRITER_OPTIONS
        local result =  pandoc.structure.make_sections(el.blocks, opts)
        return pandoc.Pandoc(result, el.meta)
      end
    },
    {
      Div = function(el) 
        if el.classes:includes('section') then
          -- Allow sections to be 'cards'
          local header = el.content[1]
          if header.t == "Header" then
            
            local contents = tslice(el.content, 2)
            return makeCard(header, contents)
          else
          end
        elseif el.classes:includes('card') then

          -- see if the card is already in the correct structure (a single header and body)
          -- exit early, not processing if it is already processed in this way
          local cardHeader = el.content[1]
          local cardBody = el.content[2]
          local hasHeader = cardHeader ~= nil and cardHeader.classes:includes('card-header')
          local hasBody = cardBody ~= nil and cardBody.classes:includes('card-body')
          if hasHeader and hasBody then
            return nil
          end

          -- Support explicit cards as divs (without the proper nested structure)
          -- First element as a header will be used as the title, if present
          -- otherwise just use the contents as the card body
          local header = el.content[1]
          local title = {}
          local contents = el.content
          if header.t == "Header" then
            title = header
            contents = tslice(el.content, 2)
          end
          return makeCard(title, contents)        
        end
      end,
    }
  }
end