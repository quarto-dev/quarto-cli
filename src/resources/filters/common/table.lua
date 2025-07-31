-- table.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- append values to table
function tappend(t, values)
  for i,value in pairs(values) do
    table.insert(t, value)
  end
end

-- prepend values to table
function tprepend(t, values)
  for i=1, #values do
   table.insert(t, 1, values[#values + 1 - i])
  end
end

-- slice elements out of a table
function tslice(t, first, last, step)
  local sliced = {}
  for i = first or 1, last or #t, step or 1 do
    sliced[#sliced+1] = t[i]
  end
  return sliced
end

-- is the table a simple array?
-- see: https://web.archive.org/web/20140227143701/http://ericjmritz.name/2014/02/26/lua-is_array/
function tisarray(t)
  if type(t) ~= "table" then 
    return false 
  end
  local i = 0
  for _ in pairs(t) do
      i = i + 1
      if t[i] == nil then return false end
  end
  return true
end

-- map elements of a table
function tmap(tbl, f)
  local t = pandoc.List({})
  for k,v in pairs(tbl) do
      t[k] = f(v)
  end
  return t
end

-- does the table contain a value
function tcontains(t,value)
  if t and type(t)=="table" and value then
    for _, v in ipairs (t) do
      if v == value then
        return true
      end
    end
    return false
  end
  return false
end

-- clear a table
function tclear(t)
  for k,v in pairs(t) do
    t[k] = nil
  end
end

-- get keys from table
function tkeys(t)
  local keyset=pandoc.List({})
  local n=0
  for k,v in pairs(t) do
    n=n+1
    keyset[n]=k
  end
  return keyset
end

-- sorted pairs. order function takes (t, a,)
function spairs(t, order)
  -- collect the keys
  local keys = {}
  for k in pairs(t) do keys[#keys+1] = k end

  -- if order function given, sort by it by passing the table and keys a, b,
  -- otherwise just sort the keys
  if order then
      table.sort(keys, function(a,b) return order(t, a, b) end)
  else
      table.sort(keys)
  end

  -- return the iterator function
  local i = 0
  return function()
      i = i + 1
      if keys[i] then
          return keys[i], t[keys[i]]
      end
  end
end

--- Checks if two tables are equal
function tequals(o1, o2)
  if o1 == o2 then
    return true
  end
  local o1type = type(o1)
  local o2type = type(o2)
  if o1type ~= o2type or o1type ~= 'table' then
    return false
  end

  local keys = {}

  for key1, value1 in pairs(o1) do
    local value2 = o2[key1]
    if value2 == nil or tequals(value1, value2) == false then
      return false
    end
    keys[key1] = true
  end

  for key2 in pairs(o2) do
    if not keys[key2] then return false end
  end
  return true
end

--- Create a deep copy of a table.
function tcopy (tbl, seen)
  local tp = type(tbl)
  if tp == 'table' then
    if seen[tbl] then
      return seen[tbl]
    end
    local copy = {}
    -- Iterate 'raw' pairs, i.e., without using metamethods
    for key, value in next, tbl, nil do
      copy[tcopy(key, seen)] = tcopy(value)
    end
    copy = setmetatable(copy, getmetatable(tbl))
    seen[tbl] = copy
    return copy
  elseif tp == 'userdata' then
    return tbl:clone()
  else -- number, string, boolean, etc
    return tbl
  end
end

