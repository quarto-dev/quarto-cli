-- docusaurus_code_blocks.lua
-- Copyright (C) 2024 Posit Software, PBC

local code_block = require('docusaurus_utils').code_block

return {
  traverse = "topdown",
  DecoratedCodeBlock = function(el)
    return nil, false -- defer to the custom renderer later in the pipeline
  end,
  CodeBlock = function(el)
    return code_block(el, el.attr.attributes["filename"])
  end,
}
