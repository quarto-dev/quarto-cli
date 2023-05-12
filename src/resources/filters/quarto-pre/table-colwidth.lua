-- table-colwidth.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local kTblColwidths = require("../modules/constants").kTblColWidths

local function noWidths(ncol)
  local widths = {}
  for i = 1,ncol do
    widths[i] = 0
  end
  return widths
end

-- takes a tblColwidths attribute value (including nil) and returns an table
-- of pandoc AST colwidths 
local function tblColwidthValues(tbl, tblColwidths)
  -- determine the widths (using any passed param as the default)
  if tblColwidths == nil then
    tblColwidths = param(kTblColwidths, true)
  elseif tblColwidths == "true" then
    tblColwidths = true
  elseif tblColwidths == "false" then
    tblColwidths = false
  end

  -- take appropriate action
  if tblColwidths == "auto" then
    local foundLink = false
    _quarto.ast.walk(tbl, {
      Link = function(el)
        foundLink = true
      end
    })
    if foundLink then
      return noWidths(#tbl.colspecs)
    else
      return nil
    end
  elseif tblColwidths == true then
    return nil
  elseif tblColwidths == false then
    return noWidths(#tbl.colspecs)
  else
    if type(tblColwidths) == "string" then
      -- provide array brackets if necessary
      if tblColwidths:find("[", 1, true) ~= 1 then
        tblColwidths = '[' .. tblColwidths .. ']'
      end
      -- decode array
      tblColwidths = quarto.json.decode(tblColwidths)
    end
    if type(tblColwidths) == "table" then
      local totalWidth = 0
      local widths = {}
      for i = 1,#tbl.colspecs do
        if i <= #tblColwidths then
          widths[i] = tblColwidths[i]
        else
          widths[i] = tblColwidths[#tblColwidths]
        end
        totalWidth = totalWidth + widths[i]
      end

      -- normalize to 100 if the total is > 100
      if totalWidth > 100 then
        for i=1,#widths do 
          widths[i] = round((widths[i]/totalWidth) * 100, 1)
        end
      end

      -- convert all widths to decimal
      for i=1,#widths do 
        widths[i] = round(widths[i] / 100, 2)
      end

      return widths
    else
      warn("Unexpected tbl-colwidths value: " .. tblColwidths)
      return nil
    end
  end
end

-- propagate cell level tbl-colwidths to tables
function table_colwidth_cell()
  return {
    Div = function(el)
      if tcontains(el.attr.classes, "cell") then
        local tblColwidths = el.attr.attributes[kTblColwidths]
        el.attr.attributes[kTblColwidths] = nil
        if tblColwidths ~= nil then
          return _quarto.ast.walk(el, {
            Table = function(tbl)
              tbl.attr.attributes[kTblColwidths] = tblColwidths
              return tbl
            end
          })
        end
      end
    end,
  }
end

-- handle tbl-colwidth
function table_colwidth()
  return {
   
    Table = function(tbl)
     
      -- see if we have a tbl-colwidths attribute
      local tblColwidths = nil
      if tbl.caption.long ~= nil and #tbl.caption.long > 0 then
        local caption =  tbl.caption.long[#tbl.caption.long]
        
        local tblCaption, attr = parseTableCaption(pandoc.utils.blocks_to_inlines({caption}))
        tblColwidths = attr.attributes[kTblColwidths]
        if tblColwidths ~= nil then
          attr.attributes[kTblColwidths] = nil
          tbl.caption.long[#tbl.caption.long] = pandoc.Plain(createTableCaption(tblCaption, attr))
        end
      end

      -- failing that check for an ambient attribute provided by a cell
      if tblColwidths == nil then
        tblColwidths = tbl.attr.attributes[kTblColwidths]
      end
      tbl.attr.attributes[kTblColwidths] = nil

      -- if we found a quarto-postprocess attribute,
      -- that means this was a table parsed from html and
      -- we don't need to do the fixups
      if tbl.attr.attributes["quarto-postprocess"] then
        return nil
      end
      
      -- realize values and apply them
      local colwidthValues = tblColwidthValues(tbl, tblColwidths)
      if colwidthValues ~= nil then
        local simpleTbl = pandoc.utils.to_simple_table(tbl)
        simpleTbl.widths = colwidthValues
        return pandoc.utils.from_simple_table(simpleTbl)
      end
    end
  }

end

