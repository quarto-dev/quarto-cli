-- cites.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local discoveredCites = pandoc.List()
local constants = require("../modules/constants")

function indexCites()   
  return {
    Div = function(el) 
      local refsIndentifier = param(constants.kRefsIndentifier)
      if el.attr.identifier == 'refs' and refsIndentifier then 
        tappend(el.content, {pandoc.Plain(refsIndentifier)})
        return el;
      end
    end,
    Cite = function(el) 
      for i,v in ipairs(el.citations) do
        discoveredCites:insert(v.id)
      end
    end
  }
end

function writeCites() 
  return {
    Pandoc = function(el)
      -- the file to write to
      local citesFilePath = param("cites-index-file")
      if citesFilePath and quarto.project.directory then
        -- open the file
        local citesRaw = _quarto.file.read(citesFilePath)
        local documentCites = {}
        if citesRaw then
          documentCites = quarto.json.decode(citesRaw)
        end

        -- write the cites
        local inputFile = quarto.doc.input_file
        local relativeFilePath = pandoc.path.make_relative(inputFile, quarto.project.directory)
        documentCites[relativeFilePath] = discoveredCites

        -- write the file
        local json = quarto.json.encode(documentCites)
        local file = io.open(citesFilePath, "w")
        if file ~= nil then
          file:write(json .. "\n")
          file:close()
        else
          fail('Error opening book citations file at ' .. citesFilePath)
        end
      end
    end
  }
end