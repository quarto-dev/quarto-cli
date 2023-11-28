-- output-location.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local function collectCellOutputLocation(el)
  if is_regular_node(el, "Div") and 
     el.attr.classes:includes("cell")  then
    local outputLoc = el.attr.attributes["output-location"]
    el.attr.attributes["output-location"] = nil 
    if outputLoc == nil then
      outputLoc = param('output-location')
    end
    return outputLoc
  else
    return nil
  end
        
end

local function outputLocationCellHasCode(el)
  return #el.content > 0 and
         el.content[1].t == "CodeBlock" and
         el.content[1].attr.classes:includes("cell-code")  
end

-- note: assumes that outputLocationCellHasCode has been called
local function partitionCell(el, outputClass)
  -- compute the code div, being sure to bring the annotations 
  -- along with the code
  local code = { el.content[1] }
  local outputIndex
  if isAnnotationCell(el.content[2]) then
    tappend(code, {el.content[2]})
    outputIndex = 3
  else
    outputIndex = 2
  end

  local codeDiv = pandoc.Div(code, el.attr)

  local outputDiv = pandoc.Div(tslice(el.content, outputIndex, #el.content), el.attr)
  outputDiv.attr.identifier = ""
  outputDiv.attr.classes:insert(outputClass)
  return { codeDiv, outputDiv }
end

local function fragmentOutputLocation(block)
  return partitionCell(block, "fragment")
end

local function slideOutputLocation(block)
  return partitionCell(block, "output-location-slide")
end

local function columnOutputLocation(el, fragment)
  local codeDiv = pandoc.Div({ el.content[1] })
  local outputDiv = pandoc.Div(tslice(el.content, 2, #el.content))
  codeDiv.attr.classes:insert("column")
  outputDiv.attr.identifier = ""
  outputDiv.attr.classes:insert("column")
  if fragment then
    outputDiv.attr.classes:insert("fragment")
  end
  local columnsDiv = pandoc.Div( {codeDiv, outputDiv}, el.attr )
  tappend(columnsDiv.attr.classes, {
    "columns", "column-output-location"
  })
  return { columnsDiv }
end

function output_location()
  if _quarto.format.isRevealJsOutput() then
    return {
      Blocks = function(blocks)
        local newBlocks = pandoc.List()
        for _,block in pairs(blocks) do
          local outputLoc = collectCellOutputLocation(block)
          if outputLoc then
            if outputLocationCellHasCode(block) then
              if outputLoc == "fragment" then
                tappend(newBlocks, fragmentOutputLocation(block))
              elseif outputLoc == "column" then
                tappend(newBlocks, columnOutputLocation(block))
              elseif outputLoc == "column-fragment" then
                tappend(newBlocks, columnOutputLocation(block, true))
              elseif outputLoc == "slide" then
                tappend(newBlocks, slideOutputLocation(block))
              else
                newBlocks:insert(block)
              end
            else
              warn("output-location is only valid for cells that echo their code")
              newBlocks:insert(block)
            end
          else
            newBlocks:insert(block)
          end
        end
        return newBlocks
      end
    }
  else
    return {}
  end
 
end




