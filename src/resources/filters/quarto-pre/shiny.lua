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

  -- Split a string on commas, trimming whitespace from each element.
  local function splitString(s)
    local t = {}
    for str in string.gmatch(s, "([^,]+)") do
        str = string.match(str, "^%s*(.-)%s*$")  -- Trim whitespace
        table.insert(t, str)
    end
    return t
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

      -- There are three types of contexts: "ui", "server-session", and
      -- "server-global". The default for a code cell is "ui" and
      -- "server-session". We also support a type called "setup", which is just
      -- shorthand for "ui" and "server-global".
      --
      -- Each cell will have some combination of the three types of contexts.
      -- For ui cells, we'll also keep the subsequent output cell.
      -- For non-ui cells, we will discard the subsequent output cell.

      -- We'll set the context when we hit a relevant Python code block. (We
      -- don't want to interfere with other types of code blocks.)
      local context = nil

      local res = pandoc.walk_block(divEl, {
        CodeBlock = function(el)
          if el.attr.classes:includes("python") and el.attr.classes:includes("cell-code") then

            context = divEl.attr.attributes["context"] or { "ui", "server-session" }

            -- "setup" is shorthand for "ui" and "server-global".
            if context == "setup" then
              context = { "ui", "server-global" }
            end

            if type(context) == "string" then
              context = splitString(context)
            end

            context = pandoc.List(context)

            -- TODO: check for names other than ui, server-session,
            -- server-global in context, and if present, error. Also, error if
            -- both server-session and server-global are present.

            table.insert(
              codeCells.cells,
              { context = context, classes = el.attr.classes, text = el.text }
            )
          end
        end,
        Div = function(el)
          -- In the HTML output, only include cell-output for ui cells.
          -- TODO: It would be better if we could avoid execution of non-ui cells.
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

      -- Convert the json file to myfile-app.py by calling `shiny convert-cells`.
      appOutfile = pandoc.path.split_extension(quarto.doc.input_file) .. "-app.py"
      callPythonShiny(
        { "cells-to-app", codeCellsOutfile, appOutfile }
      )

      -- TODO: Add option to keep file for debugging.
      os.remove(codeCellsOutfile)
    end

  }

end
