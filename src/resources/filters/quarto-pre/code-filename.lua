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
  if _quarto.format.isHtmlOutput() then
    local filenameEl = pandoc.Div({pandoc.Plain{
      pandoc.RawInline("html", "<pre>"),
      pandoc.Strong{pandoc.Str(filename)},
      pandoc.RawInline("html", "</pre>")
    }}, pandoc.Attr("", {"code-with-filename-file"}))
    return pandoc.Div(
      { filenameEl, el:clone() },
      pandoc.Attr("", {"code-with-filename"})
    )
  else
    return pandoc.Div(
      { pandoc.Plain{pandoc.Strong{pandoc.Str(filename)}}, el:clone() },
      pandoc.Attr("", {"code-with-filename"})
    )
  end
end

function codeFilename() 
  return {
    Blocks = function(blocks)
  
      -- transform ast for 'filename'
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
end
