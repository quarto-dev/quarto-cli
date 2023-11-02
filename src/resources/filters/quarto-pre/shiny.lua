-- shiny.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function server_shiny()
  if not param("is-shiny-python", false) then
    return {}
  end

  -- get python exec
  local pythonExec = param("shiny-python-exec", { "python" })

  -- Try calling `pandoc.pipe('shiny', ...)` and if it fails, print a message
  -- about installing shiny.
  local function callPythonShiny(args)
    -- build command and args
    local command = pythonExec[1]
    tprepend(args, { "-m", "shiny" })
    if #pythonExec > 1 then
      tprepend(args, tslice(pythonExec, 2, #pythonExec))
    end

    local res
    local status, err = pcall(
      function()
        res = pandoc.pipe(command, args, "")
      end
    )

    if not status then
      print(err)
      error(
        "Error running command 'shiny " ..
        table.concat(args, " ") ..
        "'. Please make sure the 'shiny' Python package is installed."
      )
      os.exit(1)
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
    Div = function(divEl)
      if not divEl.attr.classes:includes("cell") then
        return el
      end

      -- Start the context as nil and then set it when we hit a relevant Python
      -- code block. (We don't want to interfere with other types of code
      -- blocks.)
      local context = nil

      local res = pandoc.walk_block(divEl, {
        CodeBlock = function(el)
          if el.attr.classes:includes("python") and el.attr.classes:includes("cell-code") then

            context = divEl.attr.attributes["context"] or "default"

            -- Translate the context names to ones that are used by the backend
            -- which writes out the app file.
            if context == "default" then
              context = { "ui", "server" }
            elseif context == "ui" then
              context = { "ui" }
            elseif context == "setup" then
              context = { "ui", "server-setup" }
            else
              error(
                'Invalid context: "' .. context ..
                '". Valid context types are "default", "ui", and "setup".'
              )
            end

            context = pandoc.List(context)

            table.insert(
              codeCells.cells,
              { context = context, classes = el.attr.classes, text = el.text }
            )
          end
        end,
        Div = function(el)
          -- In the HTML output, only include cell-output for ui cells.
          -- `context` will be non-nil only if there's a CodeBlock in the
          -- wrapper div which has gone through the CodeBlock function above.
          if context ~= nil
            and not context:includes("ui")
            and el.attr.classes:includes("cell-output") then
              return {}
          end
        end
      })

      return res
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

      -- Convert the json file to app.py by calling `shiny convert-cells`.
      appOutfile = pandoc.path.join({
        pandoc.path.directory(quarto.doc.input_file),
        "app.py"
      });
      callPythonShiny(
        { "cells-to-app", codeCellsOutfile, appOutfile }
      )

      -- TODO: Add option to keep file for debugging.
      os.remove(codeCellsOutfile)
    end

  }

end
