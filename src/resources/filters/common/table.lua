-- table.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- append values to table
tappend = pandoc.List.extend

-- prepend values to table
function tprepend(t, values)
  local nvals = #values
  table.move(t, 1, #t, nvals + 1)     -- shift elements to make space
  table.move(values, 1, nvals, 1, t)  -- copy values into t
  return t
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
tmap = pandoc.List.map

-- does the table contain a value
function tcontains(t,value)
  if t and type(t)=="table" and value then
    return pandoc.List.includes(t, value)
  end
  return false
end

-- clear a table
function tclear(t)
  for k,_ in pairs(t) do
    t[k] = nil
  end
end

-- get keys from table
function tkeys(t)
  local keyset=pandoc.List({})
  for key in pairs(t) do
    keyset:insert(key)
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
