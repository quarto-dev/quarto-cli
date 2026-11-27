local function assert_json_error(fn, value, expected)
  local ok, message = pcall(fn, value)
  assert(not ok, "invalid JSON operation should raise an error")
  assert(type(message) == "string", "JSON errors should include a message")
  assert(message:find(expected, 1, true), message)
end

function Meta(meta)
  assert_json_error(quarto.json.decode, "not json", "invalid literal")
  assert_json_error(quarto.json.decode, '{"key": 1', "expected '}' or ','")
  assert_json_error(quarto.json.decode, "{} trailing", "trailing garbage")
  assert_json_error(quarto.json.encode, function() end, "unexpected type 'function'")
  assert_json_error(quarto.json.encode, math.huge, "unexpected number value")

  local value = {
    name = "Quarto",
    enabled = true,
    values = { 1, 2, 3 },
    nested = { message = 'quoted "text"' }
  }
  local decoded = quarto.json.decode(quarto.json.encode(value))
  assert(decoded.name == value.name)
  assert(decoded.enabled == value.enabled)
  assert(#decoded.values == #value.values)
  for i, item in ipairs(value.values) do
    assert(decoded.values[i] == item)
  end
  assert(decoded.nested.message == value.nested.message)
  return meta
end
