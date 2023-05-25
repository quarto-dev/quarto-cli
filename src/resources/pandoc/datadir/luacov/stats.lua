-----------------------------------------------------
-- Manages the file with statistics (being) collected.
-- @class module
-- @name luacov.stats
local stats = {}

-----------------------------------------------------
-- Loads the stats file.
-- @param statsfile path to the stats file.
-- @return table with data or nil if couldn't load.
-- The table maps filenames to stats tables.
-- Per-file tables map line numbers to hits or nils when there are no hits.
-- Additionally, .max field contains maximum line number
-- and .max_hits contains maximum number of hits in the file.
function stats.load(statsfile)
   local data = {}
   local fd = io.open(statsfile, "r")
   if not fd then
      return nil
   end
   while true do
      local max = fd:read("*n")
      if not max then
         break
      end
      if fd:read(1) ~= ":" then
         break
      end
      local filename = fd:read("*l")
      if not filename then
         break
      end
      data[filename] = {
         max = max,
         max_hits = 0
      }
      for i = 1, max do
         local hits = fd:read("*n")
         if not hits then
            break
         end
         if fd:read(1) ~= " " then
            break
         end
         if hits > 0 then
            data[filename][i] = hits
            data[filename].max_hits = math.max(data[filename].max_hits, hits)
         end
      end
   end
   fd:close()
   return data
end

-----------------------------------------------------
-- Saves data to the stats file.
-- @param statsfile path to the stats file.
-- @param data data to store.
function stats.save(statsfile, data)
   local fd = assert(io.open(statsfile, "w"))

   local filenames = {}
   for filename in pairs(data) do
      table.insert(filenames, filename)
   end
   table.sort(filenames)

   for _, filename in ipairs(filenames) do
      local filedata = data[filename]
      fd:write(filedata.max, ":", filename, "\n")

      for i = 1, filedata.max do
         fd:write(tostring(filedata[i] or 0), " ")
      end
      fd:write("\n")
   end
   fd:close()
end

return stats
