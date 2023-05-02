-- for code blocks w/ filename create an enclosing div:
-- <div class="code-with-filename">
--   <div class="code-with-filename-file">
--     <pre>filename.py</pre>
--   </div>
--   <div class="sourceCode" id="cb1" data-filename="filename.py">
--     <pre></pre>
--   </div>
-- </div>

local function codeBlockWithFilename(el, filename)
  return pandoc.Plain(quarto.DecoratedCodeBlock({
    filename = filename,
    code_block = el:clone()
  }))
end

function code_filename()
  local code_filename_filter = {
    -- FIXME this should be a CodeBlock and Div filter instead of Blocks,
    -- we're not splicing.
    
    -- transform ast for 'filename'
    Blocks = function(blocks)
      local foundFilename = false
      local newBlocks = pandoc.List()
      for _,block in ipairs(blocks) do
        if block.attributes ~= nil and block.attributes["filename"] then
          local filename = block.attributes["filename"]
          if block.t == "CodeBlock" then
            foundFilename = true
            block.attributes["filename"] = nil
            newBlocks:insert(codeBlockWithFilename(block, filename))
          elseif block.t == "Div" and block.content[1].t == "CodeBlock" then
            foundFilename = true
            block.attributes["filename"] = nil
            block.content[1] = codeBlockWithFilename(block.content[1], filename)
            newBlocks:insert(block)
          else
            newBlocks:insert(block)
          end
        else
          newBlocks:insert(block)
        end
      end
      -- if we found a file name then return the modified list of blocks
      if foundFilename then
        return newBlocks
      else
        return blocks
      end
    end
  }  
  return code_filename_filter
end
