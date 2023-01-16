-- todo: i18n :(
return {
  ['kbd'] = function(args, kwargs, meta)
    local function osname(v)
      if v == "win" then return "Windows" end
      if v == "mac" then return "Mac" end
      if v == "linux" then return "Linux" end       
    end
    if quarto.doc.is_format("html:js") then
      quarto.doc.add_html_dependency({
        name = 'kbd',
        scripts = { 'resources/kbd.js' },
        stylesheets = { 'resources/kbd.css' }
      })
      local kwargs_strs = {}
      for k, v in pairs(kwargs) do
        table.insert(kwargs_strs, string.format('data-%s="%s"', osname(k), pandoc.utils.stringify(v)))
      end
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
      end

      return pandoc.RawInline('html', '<kbd ' .. kwargs_str .. '>' .. default_arg_str .. '</kbd>')
    else
      -- example shortcodes
      -- {{< kbd Shift-Ctrl-P >}}
      -- {{< kbd Shift-Ctrl-P mac=Shift-Command-P >}}
      -- {{< kbd mac=Shift-Command-P win=Shift-Control-S linux=Shift-Ctrl-S >}}
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
            table.insert(result, pandoc.Str(osname(k)))
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
          error("kbd requires at least one argument")
        else
          for k, v in pairs(kwargs) do
            table.insert(result, pandoc.Code(pandoc.utils.stringify(v)))
            table.insert(result, pandoc.Str(' ('))
            table.insert(result, pandoc.Str(osname(k)))
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
