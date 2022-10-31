-- wrappedwriter.lua
-- support for creating better custom writers
--
-- Copyright (C) 2022 by RStudio, PBC

function wrapped_writer()
  return filterIf(function()
    return param("custom-writer")
  end, makeWrappedFilter(param("custom-writer"), function(handler)
  
    local resultingStrs = {}
  
    local contentHandler = function(el)
      return el.content
    end
  
    local bottomUpWalkers = {
      Pandoc = function(doc)
        local result = {}
        if doc.blocks then
          for _, block in ipairs(doc.blocks) do
            table.insert(result, block)
          end
        end
        -- TODO I think we shouldn't walk meta, but I'm not positive.
        -- if doc.meta then
        --   table.insert(result, doc.meta)
        -- end
        return result
      end,
      BlockQuote = contentHandler,
      BulletList = contentHandler,
  
      DefinitionList = contentHandler,
  
      Div = contentHandler,
      Header = contentHandler,
      LineBlock = contentHandler,
      OrderedList = contentHandler,
      Para = contentHandler,
      Plain = contentHandler,
  
      Cite = function(element)
        local result = {}
        for _, block in ipairs(element.content) do
          table.insert(result, block)
        end
        for _, block in ipairs(element.citations) do
          table.insert(result, block)
        end
        return result
      end,
  
      Emph = contentHandler,
      Image = function(element)
        return element.caption
      end,
      Link = contentHandler,
      Note = contentHandler,
      Quoted = contentHandler,
      SmallCaps = contentHandler,
      Span = contentHandler,
      Strikeout = contentHandler,
      Strong = contentHandler,
      Subscript = contentHandler,
      Superscript = contentHandler,
      Underline = contentHandler,
  
      -- default simple behavior
      Str = function(s)
        return { s.text }
      end,
      Space = function() return { " " } end,
      LineBreak = function() return { "\n" } end,
      SoftBreak = function() return { "\n" } end,
      Inlines = function(inlines)
        return inlines
      end,
      Blocks = function(blocks)
        return blocks
      end,
    }
    -- setmetatable(bottomUpWalkers, {
    --   __index = function(_, key)
    --     return function() return {} end
    --   end
    -- })  
  
    function handleBottomUpResult(v)
      if type(v) == "string" then
        table.insert(resultingStrs, v)
      elseif type(v) == "userdata" then
        bottomUp(v)
      elseif tisarray(v) then
        for _, inner in ipairs(v) do
          bottomUp(v)
        end
      end
    end
    local bottomUp
  
    bottomUp = function(node)
      if type(node) == "string" then
        table.insert(resultingStrs, node)
        return nil
      end
  
      local nodeHandler
      local t

      if type(node) == "userdata" then
        -- ast nodes: emulated, custom, or not.
        if not node.is_emulated then
          node = quarto.ast.to_emulated(node)
          if node == nil then -- shouldn't happen but let's appease the type system
            crash()
            return nil
          end            
        end
        -- postcondition: they're all emulated

        t = node.t or pandoc.utils.type(node)
        if node.is_custom then
          local astHandler = quarto.ast.resolve_handler(t)
          nodeHandler = astHandler and handler[astHandler.ast_name] and handler[astHandler.ast_name].handle
        else
          nodeHandler = handler[t] and handler[t].handle
        end
      else
        if type(node) ~= "table" then
          error("Internal error, expected type of node to be table, got " .. type(node) .. " instead")
          crash_with_stack_trace()
        end
      end
  
      if nodeHandler == nil then 
        -- no handler, just walk the internals in some default order
        if bottomUpWalkers[t] then
          for _, v in ipairs(bottomUpWalkers[t](node)) do
            bottomUp(v)
          end
        else
          for _, v in pairs(node) do
            bottomUp(v)
          end
        end
      else
        handleBottomUpResult(nodeHandler(node, bottomUp))
      end
  
      return nil
    end
  
    local wrappedFilter = {
      Pandoc = function(doc)
        local strs
        if handler.Writer then
          strs = handler.Writer.handle(doc)
        else
          bottomUp(doc)
          strs = table.concat(resultingStrs, "")
        end
        return pandoc.Pandoc(pandoc.Blocks(pandoc.RawBlock("markdown", strs .. "\n")))
      end
    }
    return wrappedFilter
  end))
end
