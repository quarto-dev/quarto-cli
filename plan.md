# Plan: Conditional Recipients for Email Format

## Issue Summary

Add support for conditional recipients in email format, where recipient lists can be computed dynamically using code (Python, R, etc.) similar to how subject lines and email text are handled.

## Context from PR #13882 (Multiple Emails)

The multiple emails PR added:

- Support for multiple `.email` divs in a single document
- V2 JSON format with `rsc_email_version: 2` and `emails` array
- Per-email metadata extraction (subject, email-text, email-scheduled)
- Metadata divs nested inside `.email` divs (v2) vs document-level (v1)

## Current Architecture

### Key Files

- **`src/resources/filters/quarto-post/email.lua`**: Main email processing filter
  - Extracts email divs and their nested metadata (subject, email-text, email-scheduled)
  - Processes images (CID tags for JSON, base64 for preview)
  - Generates `.output_metadata.json` with email data
  - Currently does NOT handle recipients
- **Test files**: `tests/docs/email/*.qmd` - various email test documents
- **Test spec**: `tests/smoke/render/render-email.test.ts` - validates email output

### Current Metadata Extraction Flow (v2 format)

1. Find all `.email` divs during first pass
2. For each `.email` div:
   - Extract nested `.subject` div → `current_email.subject`
   - Extract nested `.email-text` div → `current_email.email_text`
   - Extract nested `.email-scheduled` div → `current_email.suppress_scheduled_email`
   - Process remaining content as email body HTML
3. Generate JSON output with email metadata

### Inline Code Execution

Quarto already supports inline code execution using the pattern `` `{language} expression` ``:

- **Pattern**: `` `{python} recipients` `` or `` `{r} get_recipients()` ``
- **Implementation**: `src/core/execute-inline.ts` - `executeInlineCodeHandler()`
- **Execution engines**:
  - Jupyter (Python): `src/resources/jupyter/notebook.py` - `cell_execute_inline()`
  - Knitr (R): `src/resources/rmd/execute.R` - inline expression handling
- **Process**: Code cells execute first, then inline expressions are resolved using kernel/environment state

## Proposed Solution

### Input Format Options

#### Option 1: Inline Code Expression (SELECTED)

````markdown
::: {.email}

::: {.subject}
Weekly Report
:::

```{python}
import datetime
if datetime.date.today().weekday() < 5:
    recipients = ["user1@test.com", "user2@test.com"]
else:
    recipients = ["user3@test.com"]
```
````

::: {.recipients}
`{python} recipients`
:::

Email content here.
:::

````

**How it works**:
1. Code cell executes and sets `recipients` variable
2. Inline expression `` `{python} recipients` `` gets resolved to the string representation
3. Lua filter sees the resolved text (e.g., `["user1@test.com", "user2@test.com"]`)
4. Lua filter parses this string into an array

**Pros**:
- Consistent with existing Quarto inline code patterns
- Clear separation of code execution and metadata
- Works naturally with Quarto's execution model
- User-friendly and discoverable

### Supported Formats (Email v2 with Recipients - Initial Implementation)

**Python list syntax** (what Lua sees):
- `['user1@test.com', 'user2@test.com']` (single quotes)
- `["user1@test.com", "user2@test.com"]` (double quotes)

**R vector output** (what Lua sees):
- `"user1@test.com" "user2@test.com"` (space-separated quoted strings)

**Not supported in initial implementation**:
- JSON arrays: `["a", "b"]`
- Comma-separated: `a, b`
- Line-separated: `a\nb`
- Other formats

This limited initial scope:
- ✅ Works with standard Python and R output
- ✅ Uses only Lua's built-in string functions (no external modules needed)
- ✅ Keeps parsing simple and maintainable
- ✅ Can be extended later if dedicated parsing modules become available

### Implementation Plan

#### Phase 1: Recipients Support - Initial Implementation (Python and R formats only)
**Goal**: Get recipients working with Python and R inline expressions in email v2 format

**Supported Formats** (Email v2 with Recipients - Initial Implementation):
- **Python list syntax**: `['user1@test.com', 'user2@test.com']` (single or double quotes)
- **R vector output**: `"user1@test.com" "user2@test.com"` (quoted strings separated by spaces)

NOT supported in initial implementation:
- JSON arrays (can add later if needed)
- Comma-separated lists (can add later if needed)
- Line-separated lists (can add later if needed)

This limited approach keeps parsing simple and maintainable. We can expand to other formats later if a dedicated parsing module becomes available.

1. **Update email.lua** to extract `.recipients` div:
   ```lua
   elseif child.classes:includes("recipients") then
     current_email.recipients = parse_recipients(pandoc.utils.stringify(child))
````

2. **Implement parse_recipients()** function:
   - Try to parse as Python list: `['a', 'b']` or `["a", "b"]`
   - Try to parse as R vector: `"a" "b" "c"` (quoted strings separated by spaces)
   - On failure, log warning and return empty array (recipients are optional)

3. **Add to JSON output**:

   ```lua
   local email_json_obj = {
     email_id = idx,
     subject = email_obj.subject,
     recipients = email_obj.recipients,  -- NEW
     body_html = html_email_body,
     -- ... rest
   }
   ```

4. **Write tests**:
   - `tests/docs/email/email-recipients-python.qmd` - Python inline code
   - `tests/docs/email/email-recipients-r.qmd` - R inline code
   - Test conditional logic (weekday example from issue)
   - Test error cases (unparseable format gracefully omits recipients)

#### Phase 2: Multiple Emails with Different Recipients

**Goal**: Each email can have its own recipient list

1. **Already supported by architecture**:
   - Each `current_email` object is independent
   - Just need to extract recipients per email

2. **Test scenarios**:
   - Multiple emails with different Python-format recipients
   - Multiple emails with different R-format recipients
   - Mix of Python and R formats

#### Phase 3: Polish and Documentation

**Goal**: Clean up and document

1. **Handle missing recipients**:
   - Emails can have no recipients (Connect may specify recipients through other means)
   - No warning on missing recipients (they're optional)
   - Graceful handling of unparseable formats (logs warning, omits recipients)

2. **Documentation**:
   - Do not add documentation. We will add that in another repository

#### Future Enhancement (v2+)

When parsing infrastructure becomes available, can add support for:

- JSON arrays
- Comma-separated lists
- Line-separated lists
- Other delimiter-based formats

This will require either:

- A dedicated string parsing utility module
- JSON parsing enhancements
- Regex support library

### Technical Details

### Recipient Parsing Function (Lua)

**Supports v1 formats only**: Python list syntax and R vector output

```lua
function parse_recipients(recipient_str)
  recipient_str = str_trunc_trim(recipient_str, 10000)

  if recipient_str == "" then
    return {}
  end

  -- Try Python list format ['...', '...'] or ["...", "..."]
  if string.match(recipient_str, "^%[") and string.match(recipient_str, "%]$") then
    local content = string.sub(recipient_str, 2, -2)
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

  -- Try R vector format "a" "b" "c"
  local recipients = {}
  local found_any = false
  for quoted in string.gmatch(recipient_str, "['\"]([^'\"]+)['\"]") do
    local trimmed = str_trunc_trim(quoted, 1000)
    if trimmed ~= "" then
      table.insert(recipients, trimmed)
      found_any = true
    end
  end
  if found_any then
    return recipients
  end

  -- Could not parse - log warning and return empty
  quarto.log.warning("Could not parse recipients format: " .. recipient_str)
  return {}
end
```

**Limitations (v1)**:

- Only recognizes Python list and R vector formats
- Does not support JSON, comma-separated, or line-separated
- Can be extended later when dedicated parsing modules are available

#### JSON Output Format

```json
{
  "rsc_email_version": 2,
  "emails": [
    {
      "email_id": 1,
      "subject": "Weekly Report",
      "recipients": ["user1@test.com", "user2@test.com"],
      "body_html": "...",
      "body_text": "...",
      "attachments": [],
      "suppress_scheduled": false,
      "send_report_as_attachment": false
    }
  ]
}
```

### Test Plan

1. **Static recipients**:
   - Single recipient
   - Multiple comma-separated
   - Multiple as JSON array
   - Multiple line-separated

2. **Inline code recipients**:
   - Python: `{python} recipients`
   - R: `{r} recipients` (if supporting knitr)
   - Conditional logic (weekday example from issue)

3. **Edge cases**:
   - No recipients (optional, no warning)
   - Empty string
   - Unparseable format (logs warning, omits recipients)

4. **Format support**:
   - Python list: `['a', 'b']` or `["a", "b"]`
   - R vector: `"a" "b" "c"`

### Design Decisions (Confirmed)

1. **Required vs Optional**: ✅ Recipients are **OPTIONAL**
   - Emails can have no recipients (Connect may specify recipients through other means)
   - No warning on missing recipients

2. **Validation**: ✅ **NO validation** of email format in Lua
   - Keep Lua filter simple, let Connect handle validation

3. **R/Knitr Support**: ✅ **YES**, support R inline expressions
   - R: `recipients <- c("a@b.com", "c@d.com")` then `` `{r} recipients` ``
   - Python: `recipients = ["a@b.com", "c@d.com"]` then `` `{python} recipients` ``

4. **Document-level fallback**: ✅ **NO** document-level default recipients
   - No fallback mechanism needed
   - Each email stands alone

5. **Syntax**: ✅ **Option 1** - Inline code expression
   - Code cell defines variable → inline expression references it → Lua parses result

6. **Format scope**: ✅ **Initial implementation - Limited to Python and R formats only**
   - Only parse Python list syntax: `['a', 'b']` or `["a", "b"]`
   - Only parse R vector output: `"a" "b" "c"`
   - Do not support JSON, comma-separated, or line-separated formats
   - Can extend to other formats later if parsing modules become available

## Implementation Checklist

- [ ] Phase 1: Email v2 Recipients Support - Initial Implementation (Python and R formats)
  - [ ] Update `email.lua` to extract `.recipients` div
  - [ ] Implement `parse_recipients()` function (Python + R only)
  - [ ] Add recipients to JSON output
  - [ ] Write tests with Python inline code
  - [ ] Write tests with R inline code

- [ ] Phase 2: Multiple emails with recipients
  - [ ] Write tests for multiple emails with different recipients
  - [ ] Verify per-email recipients in JSON

- [ ] Phase 3: Polish and Documentation
  - [ ] Update schema: `src/resources/schema/document-email.yml`
  - [ ] Add examples and documentation
  - [ ] Test edge cases (empty, unparseable formats)

- [ ] Future Enhancements (v2+)
  - [ ] Add JSON array support (when parsing modules available)
  - [ ] Add comma-separated support
  - [ ] Add line-separated support
  - [ ] Add other delimiter-based formats

## Files to Modify

1. **`src/resources/filters/quarto-post/email.lua`** - Main changes:
   - Add `.recipients` extraction in `process_div()`
     Implementation Details

### What Users See vs What Lua Sees

**User writes**:

````markdown
```{python}
recipients = ["user1@test.com", "user2@test.com"]
```
````

::: {.recipients}
`{python} recipients`
:::

````

**After execution engine processes markdown, Lua filter sees**:
```markdown
::: {.recipients}
['user1@test.com', 'user2@test.com']
:::
````

**Or for R**:

```markdown
::: {.recipients}
"user1@test.com" "user2@test.com"
:::
```

The Lua filter's job is just to parse these string representations into proper arrays.

### Python Output Formats to Handle

- List: `['user1@test.com', 'user2@test.com']` (Python default repr)
- JSON: `["user1@test.com", "user2@test.com"]` (if user converts to JSON)
- Comma-separated: `user1@test.com, user2@test.com`
- Single: `user1@test.com`

### R Output Formats to Handle

- Vector: `"user1@test.com" "user2@test.com"` (R default print)
- C syntax: `c("user1@test.com", "user2@test.com")` (if echoed)
- Comma-separated: `user1@test.com, user2@test.com`

### Edge Cases

1. **Empty recipients**: `.recipients` div not present or empty → omit recipients from JSON
2. **Single recipient**: String without delimiters → single-element array
3. **Whitespace**: Trim all values
4. **Invalid format**: If can't parse, log warning and use as single recipient string
5. **`news/changelog-1.9.md`** - Add to changelog (when ready)

## Success Criteria

- [ ] Static recipients work in v2 format
- [ ] Inline code computed recipients work with Python
- [ ] Inline code computed recipients work with R (if supporting knitr)
- [ ] Multiple emails can have different recipients
- [ ] JSON output includes recipients array
- [ ] Tests pass for all scenarios
- [ ] Documentation updated
