-- path.lua
-- Copyright (C) 2026 Posit Software, PBC

-- Always use forward slashes: a path built with the native separator can
-- flow into writers (e.g. Typst 0.15+) that reject backslash path
-- separators, while forward slashes work fine for file resolution on
-- Windows too.
local function to_forward_slashes(path)
  return path:gsub('\\', '/')
end

return {
  to_forward_slashes = to_forward_slashes
}
