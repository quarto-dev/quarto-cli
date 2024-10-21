function Meta(m)
  if pandoc.utils.stringify(m.mymeta.key1) ~= "override" then
    crash()
  end
  if pandoc.utils.stringify(m.mymeta.key2) ~= "value2" then
    crash()
  end
end