-- todo: i18n :(
return {
  ['kbd'] = function(args, kwargs, meta)
    local function get_osname(v)
      if v == "win" then return "windows" end
      if v == "mac" then return "mac" end
      if v == "linux" then return "linux" end
    end

    -- Extract and validate mode kwarg
    local mode = kwargs["mode"]
    if mode ~= nil then
      mode = pandoc.utils.stringify(mode)
      kwargs["mode"] = nil
      if mode ~= "plain" then
        return quarto.shortcode.error_output("kbd", "unknown mode: " .. mode .. ", supported modes are: plain", "inline")
      end
      -- plain mode requires a positional argument
      if #args == 0 then
        return quarto.shortcode.error_output("kbd", "plain mode requires a positional argument", "inline")
      end
      -- plain mode doesn't accept OS kwargs
      for k, _ in pairs(kwargs) do
        return quarto.shortcode.error_output("kbd", "plain mode does not accept OS-specific arguments", "inline")
      end
    end

    if quarto.doc.is_format("html:js") then
      quarto.doc.add_html_dependency({
        name = 'kbd',
        scripts = { 'resources/kbd.js' },
        stylesheets = { 'resources/kbd.css' }
      })
      if mode == "plain" then
        local text = pandoc.utils.stringify(args[1])
        return pandoc.RawInline('html', '<kbd data-mode="plain" class="kbd">' .. text .. '</kbd>')
      end
      local kwargs_strs = {}
      local title_strs = {}
      for k, v in pairs(kwargs) do
        local osname = get_osname(k)
        if osname == nil then
          quarto.log.warning("unknown os name in kbd shortcode: " .. k .. ", supported names are: win, mac, linux")
          return quarto.shortcode.error_output("kbd", "unknown os name: " .. k, "inline")
        end
        table.insert(kwargs_strs, string.format('data-%s="%s"', osname, pandoc.utils.stringify(v)))
        table.insert(title_strs, osname .. ': ' .. pandoc.utils.stringify(v))
      end
      table.sort(kwargs_strs) -- sort so that the output is deterministic
      local kwargs_str = table.concat(kwargs_strs)

      local default_arg_str
      if #args == 0 then
        for k, v in pairs(kwargs) do
          default_arg_str = pandoc.utils.stringify(v)
          break
        end

        default_arg_str = ""
      else
        default_arg_str = pandoc.utils.stringify(args[1])
        table.insert(title_strs, default_arg_str)
      end
      table.sort(title_strs) -- sort so that the output is deterministic
      local title_str = table.concat(title_strs, ', ')
      if title_str == "" then
        title_str = default_arg_str
      end
      return pandoc.RawInline('html', '<kbd title="' .. title_str .. '" aria-hidden="true" ' .. kwargs_str .. '>' .. default_arg_str .. '</kbd><span class="visually-hidden">' .. default_arg_str .. '</span>')
    elseif quarto.doc.isFormat("asciidoc") then
      if args and #args == 1 then
        -- https://docs.asciidoctor.org/asciidoc/latest/macros/keyboard-macro/

        -- get the 'first' kbd shortcut as we can only produce one shortcut in asciidoc
        local shortcutText = pandoc.utils.stringify(args[1]):gsub('-', '+')

        -- from the docs:
        -- If the last key is a backslash (\), it must be followed by a space. 
        -- Without this space, the processor will not recognize the macro. 
        -- If one of the keys is a closing square bracket (]), it must be preceded by a backslash. 
        -- Without the backslash escape, the macro will end prematurely.

        if shortcutText:sub(-1) == "\\" then
          shortcutText = shortcutText .. " "
        end
        if shortcutText:find("]") then
          shortcutText = shortcutText:gsub("]", "\\]")
        end

        return pandoc.RawInline("asciidoc", "kbd:[" .. shortcutText .. "]")
      else
        return quarto.shortcode.error_output("kbd", "kbd only supports one positional argument", "inline")
      end
    else
      -- example shortcodes
      -- {{< kbd Shift-Ctrl-P >}}
      -- {{< kbd Shift-Ctrl-P mac=Shift-Command-P >}}
      -- {{< kbd mac=Shift-Command-P win=Shift-Control-S linux=Shift-Ctrl-S >}}
      if mode == "plain" then
        return pandoc.Code(pandoc.utils.stringify(args[1]))
      end
      local result = {};
      local n_kwargs = 0
      for k, v in pairs(kwargs) do
        n_kwargs = n_kwargs + 1
      end
      if #args == 1 then
        table.insert(result, pandoc.Code(pandoc.utils.stringify(args[1])))
        if n_kwargs > 0 then
          table.insert(result, pandoc.Str(' ('))
          for k, v in pairs(kwargs) do
            table.insert(result, pandoc.Str(get_osname(k)))
            table.insert(result, pandoc.Str(': '))
            table.insert(result, pandoc.Code(pandoc.utils.stringify(v)))
            n_kwargs = n_kwargs - 1
            if n_kwargs > 0 then
              table.insert(result, pandoc.Str('; '))
            end
          end
          table.insert(result, pandoc.Str(')'))
        end
      else
        -- all kwargs
        if n_kwargs == 0 then
          -- luacov: disable
          error("kbd requires at least one argument")
          -- luacov: enable
        else
          for k, v in pairs(kwargs) do
            table.insert(result, pandoc.Code(pandoc.utils.stringify(v)))
            table.insert(result, pandoc.Str(' ('))
            table.insert(result, pandoc.Str(get_osname(k)))
            table.insert(result, pandoc.Str(')'))
            n_kwargs = n_kwargs - 1
            if n_kwargs > 0 then
              table.insert(result, pandoc.Str(', '))
            end
          end
        end
      end
      return result
    end
  end
}
