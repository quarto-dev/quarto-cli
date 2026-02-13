# Research: Parsing Recipients in Lua Filter

## IMPLEMENTATION SCOPE (Email v2 Recipients - Initial Implementation)

**We are implementing ONLY**:

- Python list syntax: `['user1@test.com', 'user2@test.com']`
- R vector output: `"user1@test.com" "user2@test.com"`

**We are NOT implementing**:

- JSON arrays (future enhancements)
- Comma-separated (future enhancements)
- Line-separated (future enhancements)
- Other formats (future enhancements)

The research below documents the more general parsing approach and is available for future expansion when dedicated parsing modules become available.

### 1. JSON Parsing

- **`quarto.json.decode(str)`** - Parse JSON strings into Lua tables
  - Implemented in `src/resources/pandoc/datadir/_json.lua`
  - Handles arrays, objects, strings, numbers, booleans, null
  - Example: `["user1@test.com", "user2@test.com"]` → Lua table `{1: "user1@test.com", 2: "user2@test.com"}`
  - Can fail with error if JSON is invalid
  - **Pattern in codebase**: Use `pcall()` to safely catch JSON parse errors

### 2. String Utilities

Located in `src/resources/filters/modules/string.lua`:

- `split(str, sep)` - Split string on separator, returns table
- `trim(s)` - Remove surrounding whitespace
- Pattern matching with `string.match()`, `string.gmatch()`

Located in `src/resources/filters/common/string.lua`:

- `split(str, sep, allow_empty)` - Split with option for empty elements
- `trim(s)` - Whitespace trimming
- `patternEscape(str)` - Escape special characters for regex patterns

### 3. Table Operations (Lua built-ins)

- `table.insert(t, value)` - Add to array
- `table.concat(t, sep)` - Join array with separator
- `string.gmatch(str, pattern)` - Iterate matches in string

### 4. Error Handling Pattern

The codebase uses `pcall()` for safe error handling:

```lua
local success, result = pcall(function()
  return quarto.json.decode(str)
end)
if success and result then
  -- use result
else
  -- fallback
end
```

## Parsing Strategy for Recipients

### Goal

Accept these formats and convert to JSON array:

1. **JSON array**: `["user1@test.com", "user2@test.com"]`
2. **Python list repr**: `['user1@test.com', 'user2@test.com']`
3. **R vector output**: `"user1@test.com" "user2@test.com"`
4. **Comma-separated**: `user1@test.com, user2@test.com`
5. **Line-separated**: `user1@test.com\nuser2@test.com`
6. **Single value**: `user1@test.com`

### Implementation Approach

```lua
function parse_recipients(str)
  -- Step 1: Trim the input
  str = str_trunc_trim(str, 10000)

  if str == "" then
    return {}
  end

  -- Step 2: Try JSON parsing first (most explicit)
  local success, result = pcall(function()
    return quarto.json.decode(str)
  end)

  if success and type(result) == "table" then
    -- JSON array: ["a", "b"] or ['a', 'b']
    -- Convert to list if it's a JSON array
    local recipients = {}
    for _, email in ipairs(result) do
      table.insert(recipients, tostring(email))
    end
    if #recipients > 0 then
      return recipients
    end
  end

  -- Step 3: Try Python list format ['...', '...']
  -- Pattern: [' or " followed by content, then ' or " followed by ]
  if string.match(str, "^%[") and string.match(str, "%]$") then
    -- Remove brackets
    local content = string.sub(str, 2, -2)
    -- Try to parse as comma-separated quoted strings
    local recipients = {}
    for quoted in string.gmatch(content, "['\"]([^'\"]+)['\"]") do
      local trimmed = str_trunc_trim(quoted, 1000)
      if trimmed ~= "" then
        table.insert(recipients, trimmed)
      end
    end
    if #recipients > 0 then
      return recipients
    end
  end

  -- Step 4: Try R vector format "a" "b" "c"
  -- Look for quoted strings separated by spaces
  local recipients = {}
  local found_any = false
  for quoted in string.gmatch(str, "['\"]([^'\"]+)['\"]") do
    local trimmed = str_trunc_trim(quoted, 1000)
    if trimmed ~= "" then
      table.insert(recipients, trimmed)
      found_any = true
    end
  end
  if found_any then
    return recipients
  end

  -- Step 5: Try comma-separated
  if string.find(str, ",") then
    local recipients = {}
    for email in string.gmatch(str, "([^,]+)") do
      local trimmed = str_trunc_trim(email, 1000)
      if trimmed ~= "" then
        table.insert(recipients, trimmed)
      end
    end
    if #recipients > 0 then
      return recipients
    end
  end

  -- Step 6: Try line-separated
  if string.find(str, "\n") or string.find(str, "\r") then
    local recipients = {}
    for email in string.gmatch(str, "([^\n\r]+)") do
      local trimmed = str_trunc_trim(email, 1000)
      if trimmed ~= "" then
        table.insert(recipients, trimmed)
      end
    end
    if #recipients > 0 then
      return recipients
    end
  end

  -- Step 7: Single recipient (no delimiter)
  -- Treat the whole string as one email
  return {str}
end
```

### Why This Approach Works

1. **JSON first**: Most explicit format. If user returns JSON, parse it directly.
2. **Python list syntax**: Recognizes Python's default `repr()` output with single or double quotes.
3. **R vector output**: Recognizes R's default `print()` format with quoted strings separated by spaces.
4. **Fallback delimiters**: Handles simpler formats (comma, newline-separated).
5. **Single value**: Always has a fallback for single email addresses.

### Integration with email.lua

**Current pattern in email.lua** (for subject, email-text):

```lua
elseif child.classes:includes("subject") then
  current_email.subject = pandoc.utils.stringify(child)
```

**For recipients**, would be:

```lua
elseif child.classes:includes("recipients") then
  local recipients_str = pandoc.utils.stringify(child)
  current_email.recipients = parse_recipients(recipients_str)
end
```

Then in JSON output:

```lua
local email_json_obj = {
  email_id = idx,
  subject = email_obj.subject,
  recipients = email_obj.recipients,  -- NEW
  body_html = html_email_body,
  -- ... rest
}
```

### Testing the Parser

Test cases to validate:

```python
# Python example - what Lua will see:
recipients = ["user1@test.com", "user2@test.com"]
# String repr: "['user1@test.com', 'user2@test.com']"

# Or JSON string:
# String repr: '["user1@test.com", "user2@test.com"]'
```

```r
# R example - what Lua will see:
recipients <- c("user1@test.com", "user2@test.com")
# String repr: "user1@test.com" "user2@test.com"
```

### Performance Considerations

- Parsing is done once per email during render, not a bottleneck
- Max recipients string length: 10,000 chars (reasonable limit)
- Max email length: 1,000 chars per recipient (prevents abuse)
- Pattern matching is efficient in Lua

### Error Handling

If parsing completely fails:

```lua
if #recipients == 0 then
  quarto.log.warning("Could not parse recipients from: " .. str)
  -- Return empty array, let Connect handle missing recipients
  return {}
end
```

This is consistent with the "recipients are optional" requirement.

## Key Advantages of This Approach

1. ✅ Handles all three formats (JSON, Python, R)
2. ✅ Uses built-in Lua functions (no external dependencies)
3. ✅ Graceful fallbacks (comma-separated → line-separated → single)
4. ✅ Error-safe (no exceptions on invalid input)
5. ✅ Consistent with existing email.lua patterns
6. ✅ No validation of email format (leaves to Connect)
7. ✅ Works with inline code execution (which resolves before Lua runs)
