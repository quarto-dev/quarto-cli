function Pandoc(doc)
  if os.getenv("LUA_CPATH") ~= "" then
    crash_here()
  end
end