-- llms-conditional-content.lua
-- Copyright (C) 2020-2026 Posit Software, PBC
--
-- Pre-filter that intercepts ConditionalBlock nodes referencing llms-txt
-- and replaces them with marker Divs so content can be included/excluded
-- from llms.md output independently of the HTML format.
-- Only runs when llms-txt is enabled (guarded by filterIf in main.lua).

function llms_resolve_conditional_content()
  -- Determine if a ConditionalBlock should be visible for llms-txt output.
  -- Returns true (include), false (exclude), or nil (no llms-txt condition).
  local function is_llms_visible(tbl)
    local constants = require("modules/constants")
    local function list_contains(list, value)
      if not list then return false end
      for _, v in ipairs(list) do
        if v == value then return true end
      end
      return false
    end

    local cond = tbl.condition
    local has_when = list_contains(cond[constants.kWhenFormat], "llms-txt")
    local has_unless = list_contains(cond[constants.kUnlessFormat], "llms-txt")

    if not has_when and not has_unless then return nil end

    if tbl.behavior == constants.kContentVisible then
      -- content-visible when-format="llms-txt" -> include for llms
      -- content-visible unless-format="llms-txt" -> exclude for llms
      return has_when
    else -- content-hidden
      -- content-hidden when-format="llms-txt" -> exclude for llms
      -- content-hidden unless-format="llms-txt" -> include for llms
      return has_unless
    end
  end

  return {
    ConditionalBlock = function(tbl)
      local llms_visible = is_llms_visible(tbl)
      if llms_visible == nil then return nil end

      local html_visible = is_visible(tbl)  -- from content-hidden.lua
      if llms_visible == html_visible then return nil end  -- no intervention needed

      local div = tbl.original_node:clone()
      if llms_visible then
        div.classes:insert("llms-conditional-content")
      else
        div.classes:insert("llms-hidden-content")
      end
      return div
    end
  }
end
