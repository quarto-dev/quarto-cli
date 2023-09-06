-- jats.lua
-- Copyright (C) 2021-2022 Posit Software, PBC
local normalizeAuthors = require 'modules/authors'
local normalizeLicense = require 'modules/license'

local constants = require("modules/constants")

local function isCell(el) 
  return el.classes:includes("cell") 
end

local function jatsMeta(meta) 
  -- inspect the meta and set flags that will aide the rendering of
  -- the JATS template by providing some synthesize properties
  -- to prevent empty container XML elements

  -- are there author notes?
  local authors = meta[normalizeAuthors.constants.author.output_key]
  if authors ~= nil then

    -- has author notes
    local hasNotes = authors:find_if(function(author) 
      local hasAttr = author[normalizeAuthors.constants.author.attributes] ~= nil and next(author[normalizeAuthors.constants.author.attributes])
      local hasNote = author[normalizeAuthors.constants.author.note] and next(author[normalizeAuthors.constants.author.note])
      return hasAttr or hasNote
    end)

    -- has permissions
    local hasCopyright = meta[normalizeLicense.constants.copyright] ~= nil
    local hasLicense = meta[normalizeLicense.constants.license] ~= nil
    local hasPermissions = hasCopyright or hasLicense

    if meta[constants.kQuartoInternal] == nil then
      meta[constants.kQuartoInternal] = {}
    end
    meta[constants.kQuartoInternal][constants.kHasAuthorNotes] = hasNotes;
    meta[constants.kQuartoInternal][constants.kHasPermissions] = hasPermissions;

    -- normalize keywords into tags if they're present and tags aren't
    if meta[constants.kTags] == nil and meta[constants.kKeywords] ~= nil and meta[constants.kKeywords].t == "Table" then
      meta[constants.kKeywords] = meta[constants.kTags]
    end

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

function jatsCallout(node)
  local contents = resolveCalloutContents(node, true)

  local boxedStart = '<boxed-text>'
  if node.id and node.id ~= "" then
    boxedStart = "<boxed-text id='" .. node.id .. "'>"
  end
  contents:insert(1, pandoc.RawBlock('jats', boxedStart))
  contents:insert(pandoc.RawBlock('jats', '</boxed-text>'))
  return contents
end

function jats()
  if _quarto.format.isJatsOutput() then
    return {
      Meta = jatsMeta,
  
      -- clear out divs
      Div = function(div)
        if isTableDiv(div) then
          local tbl = div.content[1]
          if tbl.t == "Table" then
            tbl.identifier = div.identifier
          end
          return tbl
        else
          -- otherwise, if this is a div, we can unroll its contents
          return unrollDiv(div)
        end
      end,

      Callout = jatsCallout,

    }  
  else 
    return {}
  end
end

function jatsSubarticle() 

  if _quarto.format.isJatsOutput() then

    local isCodeCell = function(el) 
      return not el.classes:includes('markdown')
    end

    local isCodeCellOutput = function(el)
      return el.classes:includes("cell-output")
    end

    local ensureValidIdentifier = function(identifier) 
      -- Identifiers may not start with a digit, so add a prefix
      -- if necessary to ensure that they're valid
      if identifier:find('^%d.*') then
        return "cell-" .. identifier
      else
        return identifier
      end
    end

    local cellId = function(identifier)
      if identifier == nil or identifier == "" then
        return ""
      else
        return ' id="' .. ensureValidIdentifier(identifier) .. '"'
      end
    end

    local function renderCell(el, type)
      local renderedCell = pandoc.List()
      renderedCell:insert(pandoc.RawBlock('jats', '<sec' .. cellId(el.identifier) .. ' specific-use="' .. type .. '">'))
      for _i, v in ipairs(el.content) do
        renderedCell:insert(v)
      end
      renderedCell:insert(pandoc.RawBlock('jats', '</sec>'))
      return renderedCell
    end

    local function renderCellOutput(el, type)
      local renderedCell = pandoc.List()
      renderedCell:insert(pandoc.RawBlock('jats', '<sec' .. cellId(el.identifier) .. ' specific-use="' .. type .. '">'))
      for _i, v in ipairs(el.content) do
        renderedCell:insert(v)
      end
      renderedCell:insert(pandoc.RawBlock('jats', '</sec>'))
      return renderedCell
    end

    local unidentifiedCodeCellCount = 0
    return {
      Meta = jatsMeta,
      Div = function(div)
        
        -- this is a notebook cell, handle it
        if isCell(div) then
          if isCodeCell(div) then

              -- if this is an executable notebook cell, walk the contents and add identifiers
              -- to the outputs
              if div.identifier == nil or div.identifier == "" then
                unidentifiedCodeCellCount = unidentifiedCodeCellCount + 1
                div.identifier = 'nb-code-cell-' .. tostring(unidentifiedCodeCellCount)
              end
              local parentId = div.identifier

              -- JATS requires that sections that contain other sections must 
              -- have the section after elements like code
              -- so this moves the sections to the bottom of the element
              local outputEls = pandoc.List()
              local otherEls = pandoc.List()
              for i, v in ipairs(div.content) do
                if v.t == "Div" and isCodeCellOutput(v) then
                  outputEls:extend({v})
                else
                  otherEls:extend({v})
                end
              end
              local orderedContents = pandoc.List()
              orderedContents:extend(otherEls)
              orderedContents:extend(outputEls)
              div.content = orderedContents

              local count = 0
              div = _quarto.ast.walk(div, {
                Div = function(childEl)
                  if (isCodeCellOutput(childEl)) then
                    childEl.identifier = parentId .. '-output-' .. count
                    count = count + 1
                    return renderCellOutput(childEl, constants.kNoteBookOutput)
                  end
                end
              })

            -- render the cell
            return renderCell(div, constants.kNoteBookCode)
          else
            if #div.content == 0 then
              -- eat empty markdown cells
              return {}
            else
              -- the is a valid markdown cell, let it through              
              return renderCell(div, constants.kNoteBookContent)
            end
          end
        elseif isCodeCellOutput(div) then
          -- do nothing
        else
          -- Forward the identifier from a table div onto the table itself and 
          -- discard the div
          if isTableDiv(div) then
            local tbl = div.content[1]
            tbl.identifier = div.identifier
            return tbl
          else
            -- otherwise, if this is a div, we can unroll its contents
            return unrollDiv(div, function(el) 
              return isCodeCellOutput(el) or isCell(el)
            end)
          end 

        end
      end,
    }

  else 
    return {}
  end
end
