-- pandoc.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local readqmd = require("readqmd")

function hasBootstrap() 
  local hasBootstrap = param("has-bootstrap", false)
  return hasBootstrap
end

-- read attribute w/ default
function attribute(el, name, default)
  return el.attributes[name] or default
end

function removeClass(classes, remove)
  return classes:filter(function(clz) return clz ~= remove end)
end

function combineFilters(filters) 

  -- the final list of filters
  local filterList = {}
  for _, filter in ipairs(filters) do
    for key,func in pairs(filter) do

      -- ensure that there is a list for this key
      if filterList[key] == nil then
        filterList[key] = pandoc.List()
      end

      -- add the current function to the list
      filterList[key]:insert(func)
    end
  end

  local combinedFilters = {}
  for key,fns in pairs(filterList) do

    -- if there is only one function for this key
    -- just use it
    if #fns == 1 then
      combinedFilters[key] = fns[1]
    else
      -- otherwise combine them into a single function
      combinedFilters[key] = function(x) 
        -- capture the current value
        local current = x

        -- iterate through functions for this key
        for _, fn in ipairs(fns) do
          local result = fn(current)
          if result ~= nil then
            -- if there is a result from this function
            -- update the current value with the result
            current = result
          end
        end

        -- return result from calling the functions
        return current
      end
    end
  end
  return combinedFilters
end

function inlinesToString(inlines)
  local pt = pandoc.utils.type(inlines)
  if pt ~= "Inlines" then
    -- luacov: disable
    fail("inlinesToString: expected Inlines, got " .. pt)
    return ""
    -- luacov: enable
  end
  return pandoc.utils.stringify(pandoc.Span(inlines))
end

-- lua string to pandoc inlines
function stringToInlines(str)
  if str then
    return pandoc.Inlines({pandoc.Str(str)})
  else
    return pandoc.Inlines({})
  end
end

-- FIXME we should no longer be using this.
-- lua string with markdown to pandoc inlines
function markdownToInlines(str)
  if str then
    local doc = pandoc.read(str)
    if #doc.blocks == 0 then
      return pandoc.List({})
    else
      return doc.blocks[1].content
    end
  else
    return pandoc.List()
  end
end

function stripTrailingSpace(inlines)
  -- we always convert to pandoc.List to ensure a uniform
  -- return type (and its associated methods)
  if #inlines > 0 then
    if inlines[#inlines].t == "Space" then
      return pandoc.List(tslice(inlines, 1, #inlines - 1))
    else
      return pandoc.List(inlines)
    end
  else
    return pandoc.List(inlines)
  end
end

-- non-breaking space
function nbspString()
  return pandoc.Str '\u{a0}'
end

-- the first heading in a div is sometimes the caption
function resolveHeadingCaption(div) 
  local capEl = div.content[1]
  if capEl ~= nil and is_regular_node(capEl, "Header") then
    div.content:remove(1)
    return capEl.content
  else 
    return nil
  end
end

local kBlockTypes = {
  "BlockQuote",
  "BulletList", 
  "CodeBlock ",
  "DefinitionList",
  "Div",
  "Header",
  "HorizontalRule",
  "LineBlock",
  "OrderedList",
  "Para",
  "Plain",
  "RawBlock",
  "Table"
}

function isBlockEl(el)
  return tcontains(kBlockTypes, el.t)
end

function isInlineEl(el)
  return not isBlockEl(el)
end

function compileTemplate(template, meta)
  local f = io.open(pandoc.utils.stringify(template), "r")
  if f then
    local contents = f:read("*all")
    f:close()
    -- compile the title block template
    local compiledTemplate = pandoc.template.compile(contents)
    local template_opts = pandoc.WriterOptions {template = compiledTemplate}  

    -- render the current document and read it to generate an AST for the
    -- title block
    local metaDoc = pandoc.Pandoc(pandoc.Blocks({}), meta)
    local rendered = pandoc.write(metaDoc, 'gfm', template_opts)

    -- read the rendered document 
    local renderedDoc = pandoc.read(rendered, 'gfm')

    return renderedDoc.blocks
  else
    -- luacov: disable
    fail('Error compiling template: ' .. template)
    -- luacov: enable
  end
end


function merge_attrs(attr, ...)
  local result = pandoc.Attr(attr.identifier, attr.classes, attr.attributes)
  for _, a in ipairs({...}) do
    if a ~= nil then
      result.identifier = result.identifier or a.identifier
      result.classes:extend(a.classes)
      for k, v in pairs(a.attributes) do
        result.attributes[k] = v
      end
    end
  end
  return result
end

-- used to convert metatable, attributetable, etc
-- to plain tables that can be serialized to JSON
function as_plain_table(value)
  local result = {}
  for k, v in pairs(value) do
    result[k] = v
  end
  return result
end

function string_to_quarto_ast_blocks(text, opts)
  local doc = readqmd.readqmd(text, opts or quarto_global_state.reader_options)
  
  -- run the whole normalization pipeline here to get extended AST nodes, etc.
  for _, filter in ipairs(quarto_ast_pipeline()) do
    doc = doc:walk(filter.filter)
  end

  -- compute flags so we don't skip filters that depend on them
  doc:walk(compute_flags())
  return doc.blocks
end

function string_to_quarto_ast_inlines(text, sep)
  return pandoc.utils.blocks_to_inlines(string_to_quarto_ast_blocks(text), sep)
end