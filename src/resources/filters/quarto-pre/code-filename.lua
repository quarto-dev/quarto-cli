-- for code blocks w/ filename create an enclosing div:
-- <div class="code-with-filename">
--   <div class="code-with-filename-file">
--     <pre>filename.py</pre>
--   </div>
--   <div class="sourceCode" id="cb1" data-filename="filename.py">
--     <pre></pre>
--   </div>
-- </div>

function code_filename()
  local function codeBlockWithFilename(el, filename)
    return quarto.DecoratedCodeBlock({
      filename = filename,
      code_block = el:clone()
    })
  end

  local code_filename_filter = {
    CodeBlock = function(code)
      local filename = code.attributes["filename"]
      if filename then
        return codeBlockWithFilename(code, filename)
      end
    end,

    -- this is a weird rule, we should make sure to document it
    -- to users
    Div = function(div)
      local filename = div.attributes["filename"]
      if filename and div.content[1].t == "CodeBlock" then
        local decorated_block = codeBlockWithFilename(div.content[1], filename)
        div.attributes["filename"] = nil
        div.content[1] = decorated_block
        return div
      end
    end,
    
    -- -- transform ast for 'filename'
    -- Blocks = function(blocks)
    --   local foundFilename = false
    --   local newBlocks = pandoc.List()
    --   for _,block in ipairs(blocks) do
    --     if block.attributes ~= nil and block.attributes["filename"] then
    --       local filename = block.attributes["filename"]
    --       if block.t == "CodeBlock" then
    --         foundFilename = true
    --         block.attributes["filename"] = nil
    --         local code_block = codeBlockWithFilename(block, filename)
    --         newBlocks:insert(code_block)
    --       elseif block.t == "Div" and block.content[1].t == "CodeBlock" then
    --         foundFilename = true
    --         block.attributes["filename"] = nil
    --         block.content[1] = codeBlockWithFilename(block.content[1], filename)
    --         newBlocks:insert(block)
    --       else
    --         newBlocks:insert(block)
    --       end
    --     else
    --       newBlocks:insert(block)
    --     end
    --   end
    --   -- if we found a file name then return the modified list of blocks
    --   if foundFilename then
    --     return newBlocks
    --   else
    --     return blocks
    --   end
    -- end
  }  
  return code_filename_filter
end
