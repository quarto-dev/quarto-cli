-- shiny.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function server_shiny()
  if not param("is-shiny-python", false) then
    return {}
  end

  -- Try calling `pandoc.pipe('shiny', ...)` and if it fails, print a message
  -- about installing shiny.
  local function callPythonShiny(args)
    local res
    local status, err = pcall(
      function()
        res = pandoc.pipe("shiny", args, "")
      end
    )

    if not status then
      print(err)
      error(
        "Error running command 'shiny " ..
        table.concat(args, " ") ..
        "'. Please make sure the 'shiny' Python package is installed."
      )
    end

    return res
  end


  local function getShinyDeps()
    local depJson = callPythonShiny(
      { "get-shiny-deps" }
    )

    local deps = quarto.json.decode(depJson)
    return deps
  end



  local codeCells = {
    schema_version = 1,
    cells = {},
    html_file = ""
  }

  return {

    CodeBlock = function(el)
      if el.attr.classes:includes("python") and el.attr.classes:includes("cell-code") then
        table.insert(codeCells.cells, { classes = el.attr.classes, text = el.text })
      end
      return el
    end,

    Pandoc = function(doc)
      codeCells["html_file"] = pandoc.path.split_extension(
        pandoc.path.filename(quarto.doc.output_file)
      ) .. ".html"

      -- Get the shiny dependency placeholder and add it to the document.
      local baseDeps = getShinyDeps()
      for idx, dep in ipairs(baseDeps) do
        quarto.doc.add_html_dependency(dep)
      end

      -- Write the code cells to a temporary file.
      codeCellsOutfile = pandoc.path.split_extension(quarto.doc.input_file) .. "-cells.tmp.json"
      local file = io.open(codeCellsOutfile, "w")
      if file == nil then
        error("Error opening file: " .. codeCellsOutfile .. " for writing.")
      end
      file:write(quarto.json.encode(codeCells))
      file:close()

      -- Convert the json file to myfile-app.py by calling `shiny convert-cells`.
      appOutfile = pandoc.path.split_extension(quarto.doc.output_file) .. "-app.py"
      callPythonShiny(
        { "cells-to-app", codeCellsOutfile, appOutfile }
      )

      os.remove(codeCellsOutfile)
    end

  }

end
