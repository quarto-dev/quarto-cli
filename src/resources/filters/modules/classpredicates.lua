-- classpredicates.lua
-- Copyright (C) 2024 Posit Software, PBC

local function isCell(el) 
  return el.classes:includes("cell") 
end

local function isCodeCellOutput(el)
  return el.classes:includes("cell-output")
end

local function isCallout(class)
  return class == 'callout' or class:match("^callout%-")
end

local function isDocxCallout(class)
  return class == "docx-callout"
end

local function isCodeCell(class)
  return class == "cell"
end

local function isCodeCellDisplay(class)
  return class == "cell-output-display"
end

return {
  isCallout = isCallout,
  isCell = isCell,
  isCodeCell = isCodeCell,
  isCodeCellDisplay = isCodeCellDisplay,
  isCodeCellOutput = isCodeCellOutput,
  isDocxCallout = isDocxCallout
}