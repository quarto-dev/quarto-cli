return {
  -- returns a placeholder data URI image of the specified size
  ['placeholder'] = function(args, kwargs, _meta, _rawargs, context)
    local width = args[1] or "100"
    local height = args[2] or width
    local size_str = tostring(width) .. " x " .. tostring(height)
    local svg_open = "<svg width = \"" .. width .. "\" height = \"" .. height .. "\" xmlns = \"http://www.w3.org/2000/svg\" viewBox = \"0 0 " .. width .. " " .. height .. "\">"
    local svg_close = "</svg>"
    local rect = "<rect width = \"" .. width .. "\" height = \"" .. height .. "\" fill = \"#ddd\" />"
    local font_size = math.floor(0.1 * math.min(tonumber(width) or 100, tonumber(height) or 100))
    local text = "<text x = \"50%\" y = \"50%\" font-family = \"sans-serif\" font-size = \"" .. tostring(font_size) .. "\" fill = \"#000\" text-anchor = \"middle\">" .. size_str .. "</text>"
    local svg = svg_open .. rect .. text .. svg_close
    local svg64 = "data:image/svg+xml;base64," .. quarto.base64.encode(svg)
    local result

    local output_format = pandoc.utils.stringify(kwargs["format"])
    if output_format == "" then
      if quarto.format.is_typst_output() then
        output_format = "svg"
      else 
        output_format = "png"
      end
    end

    if output_format == "svg" then
      result = svg64
    else
      local ok, contents = pcall(function()
        return pandoc.system.with_temporary_directory('placeholder', function(tmpdir)
          local svg_in = pandoc.path.join({tmpdir, 'in.svg'})
          local typ_in = pandoc.path.join({tmpdir, 'in.typ'})
          local png_out = pandoc.path.join({tmpdir, 'out.png'})
          local sf = assert(io.open(svg_in, 'wb'))
          sf:write(svg)
          sf:close()
          local tf = assert(io.open(typ_in, 'wb'))
          tf:write('#set page(width: auto, height: auto, margin: 0pt)\n#image("in.svg")\n')
          tf:close()
          pandoc.pipe(quarto.paths.typst(), {
            'compile', '--root', tmpdir, '--format', 'png', '--ppi', '96',
            '--ignore-system-fonts', typ_in, png_out
          }, '')
          local pf = assert(io.open(png_out, 'rb'))
          local data = pf:read('*a')
          pf:close()
          return data
        end)
      end)
      if not ok or contents == nil or contents == '' then
        -- Local, offline rasterization: a failure is a real bug, not a flake. Fail loudly.
        -- Do NOT substitute other content (that silent substitution was the original bug).
        fatal('placeholder: failed to rasterize SVG to PNG via typst (' .. tostring(contents) .. ')')
      end
      result = 'data:image/png;base64,' .. quarto.base64.encode(contents)
    end

    if context == "text" then
      return result
    else
      return pandoc.Image({}, result)
    end
  end
}
