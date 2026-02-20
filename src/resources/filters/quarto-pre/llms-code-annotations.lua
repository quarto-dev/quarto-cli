-- llms-code-annotations.lua
-- Copyright (C) 2020-2026 Posit Software, PBC
--
-- Saves original CodeBlock text before code-annotation.lua strips markers.
-- Only runs when llms-txt is enabled (guarded by filterIf in main.lua).

function llms_save_code_annotations()
  return {
    CodeBlock = function(el)
      if el.text:match("<%d+>") then
        el.attributes["data-llms-code-original"] = el.text
      end
      return el
    end
  }
end
