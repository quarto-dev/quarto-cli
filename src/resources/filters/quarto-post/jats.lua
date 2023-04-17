-- jats.lua
-- Copyright (C) 2021-2022 Posit Software, PBC



local function jatsMeta(meta) 
  -- inspect the meta and set flags that will aide the rendering of
  -- the JATS template by providing some synthesize properties
  -- to prevent empty container XML elements

  -- are there author notes?
  local authors = meta['authors']
  if authors ~= nil then

    -- has author notes
    local hasNotes = authors:find_if(function(author) 
      local hasAttr = author['attributes'] ~= nil and next(author['attributes'])
      local hasNote = author['note'] and next(author['note'])
      return hasAttr or hasNote
    end)

    -- has permissions
    local hasCopyright = meta['copyright'] ~= nil
    local hasLicense = meta['license'] ~= nil
    local hasPermissions = hasCopyright or hasLicense

    if meta['quarto-internal'] == nil then
      meta['quarto-internal'] = {}
    end
    meta['quarto-internal']['has-author-notes'] = hasNotes;
    meta['quarto-internal']['has-permissions'] = hasPermissions;

    return meta
  end
end

function unrollDiv(div, fnSkip)

  -- unroll blocks contained in divs
  local blocks = pandoc.List()
  for _, childBlock in ipairs(div.content) do
    if childBlock.t == "Div" then
      if fnSkip and not fnSkip(div) then
        blocks:insert(childBlock)
      else
        tappend(blocks, childBlock.content)
      end
    else
      blocks:insert(childBlock)
    end
  end
  return blocks
end


function jats()
  if _quarto.format.isJatsOutput() then
    return {
      Meta = jatsMeta,
  
      -- clear out divs
      Div = unrollDiv
    }  
  end
end

function jatsSubarticle() 

  if _quarto.format.isJatsOutput() then

    local kNoteBookCode = "notebook-code"
    local kNoteBookContent = "notebook-content"
    local kNoteBookOutput = "notebook-output"

    local isCell = function(el) 
      return el.classes:includes("cell") 
    end

    local isCodeCell = function(el) 
      return not el.classes:includes('markdown')
    end

    local isCodeCellOutput = function(el)
      return el.classes:includes("cell-output")
    end

    local function renderCell(el, type)
      local renderedCell = pandoc.List()
      renderedCell:insert(pandoc.RawBlock('jats', '<boxed-text id="' .. el.identifier .. '" content-type="' .. type .. '">'))
      for _i, v in ipairs(el.content) do
        renderedCell:insert(v)
      end
      renderedCell:insert(pandoc.RawBlock('jats', '</boxed-text>'))
      return renderedCell
    end

    local function renderCellOutput(el, type)
      local renderedCell = pandoc.List()
      renderedCell:insert(pandoc.RawBlock('jats', '<boxed-text id="' .. el.identifier .. '" content-type="' .. type .. '">'))
      for _i, v in ipairs(el.content) do
        renderedCell:insert(v)
      end
      renderedCell:insert(pandoc.RawBlock('jats', '</boxed-text>'))
      return renderedCell
    end

    return {
      Meta = jatsMeta,

      -- id="nb1-cell-1" content-type="notebook-content"
      -- id="nb1-cell-2" content-type="notebook-code"
      -- id="nb1-cell-3" content-type="notebook-code"

      Div = function(div)
        
        -- TODO: Code cell with #fig-asdas label gets turned into a figure div, need to stop that
        -- TODO: Add content types

        -- this is a notebook cell, handle it
        if isCell(div) then
          if isCodeCell(div) then
            -- render the cell
            return renderCell(div, kNoteBookCode)
          else
            if #div.content == 0 then
              -- eat empty markdown cells
              return {}
            else
              -- the is a valid markdown cell, let it through              
              return renderCell(div, kNoteBookContent)
            end
          end
        elseif isCodeCellOutput(div) then
          return renderCellOutput(div, kNoteBookOutput)
        else
          -- otherwise, if this is a div, we can unroll its contents
          return unrollDiv(div, function(el) 
            return isCodeCellOutput(el) or isCell(el)
          end)
        end
      end
    }



  end
end
