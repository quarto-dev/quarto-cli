------------------------
-- Hook module, creates debug hook used by LuaCov.
-- @class module
-- @name luacov.hook
local hook = {}

----------------------------------------------------------------
local dir_sep = package.config:sub(1, 1)
if not dir_sep:find("[/\\]") then
   dir_sep = "/"
end

--- Creates a new debug hook.
-- @param runner runner module.
-- @return debug hook function that uses runner fields and functions
-- and sets `runner.data`.
function hook.new(runner)
   local ignored_files = {}
   local steps_after_save = 0

   return function(_, line_nr, level)
      -- Do not use string metamethods within the debug hook:
      -- they may be absent if it's called from a sandboxed environment
      -- or because of carelessly implemented monkey-patching.
      level = level or 2
      if not runner.initialized then
         return
      end

      -- Get name of processed file.
      local name = debug.getinfo(level, "S").source
      local prefixed_name = string.match(name, "^@(.*)")
      if prefixed_name then
         name = prefixed_name:gsub("^%.[/\\]", ""):gsub("[/\\]", dir_sep)
      elseif not runner.configuration.codefromstrings then
         -- Ignore Lua code loaded from raw strings by default.
         return
      end

      local data = runner.data
      local file = data[name]

      if not file then
         -- New or ignored file.
         if ignored_files[name] then
            return
         elseif runner.file_included(name) then
            file = {max = 0, max_hits = 0}
            data[name] = file
         else
            ignored_files[name] = true
            return
         end
      end

      if line_nr > file.max then
         file.max = line_nr
      end

      local hits = (file[line_nr] or 0) + 1
      file[line_nr] = hits

      if hits > file.max_hits then
         file.max_hits = hits
      end

      if runner.tick then
         steps_after_save = steps_after_save + 1

         if steps_after_save == runner.configuration.savestepsize then
            steps_after_save = 0

            if not runner.paused then
               runner.save_stats()
            end
         end
      end
   end
end

return hook
