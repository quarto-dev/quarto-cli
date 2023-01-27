-- decoratedcodeblock.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- A custom AST node for decorated code blocks
-- so we can render the decorations in the right order

_quarto.ast.add_handler({
  -- decorated code blocks can't be represented as divs in markdown, they can
  -- only be constructed directly in Lua
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "DecoratedCodeBlock",

  -- callouts will be rendered as blocks
  kind = "Block",

  -- a function that takes the div node as supplied in user markdown
  -- and returns the custom node
  parse = function(div)
    print("internal error, should not have arrived here")
    crash_with_stack_trace()
  end,

  -- a function that renders the extendedNode into output
  render = function(node)
    local el = node.code_block
    if _quarto.format.isHtmlOutput() then
      local filenameEl
      local caption
      local classes = pandoc.List()
      local fancy_output = false
      if node.filename ~= nil then
        filenameEl = pandoc.Div({pandoc.Plain{
          pandoc.RawInline("html", "<pre>"),
          pandoc.Strong{pandoc.Str(node.filename)},
          pandoc.RawInline("html", "</pre>")
        }}, pandoc.Attr("", {"code-with-filename-file"}))
        classes:insert("code-with-filename")
        fancy_output = true
      end
      if node.caption ~= nil then
        local order = node.order
        local captionContent = node.caption
        tprepend(captionContent, listingTitlePrefix(order))
        caption = pandoc.Para(captionContent)
        classes:insert("listing")
        fancy_output = true
      end

      if not fancy_output then
        return el
      end

      local blocks = pandoc.Blocks({})
      if caption ~= nil then
        blocks:insert(caption)
      end
      if filenameEl ~= nil then
        blocks:insert(filenameEl)
      end
      blocks:insert(el)

      return pandoc.Div(blocks, pandoc.Attr("", classes))
    elseif _quarto.format.isLatexOutput() then
      -- add listing class to the code block
      el.attr.classes:insert("listing")

      -- if we are use the listings package we don't need to do anything
      -- further, otherwise generate the listing div and return it
      if not latexListings() then
        local listingDiv = pandoc.Div({})
        listingDiv.content:insert(pandoc.RawBlock("latex", "\\begin{codelisting}"))
        local listingCaption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
        local captionContent = node.caption
        if node.filename ~= nil then
          tprepend(captionContent, {
            pandoc.RawInline("latex", "\\texttt{" .. node.filename .. "}: ")
          })
        end
        listingCaption.content:extend(captionContent)
        listingCaption.content:insert(pandoc.RawInline("latex", "}"))
        listingDiv.content:insert(listingCaption)
        listingDiv.content:insert(el)
        listingDiv.content:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))
        return listingDiv
      end
      return el
    else
      -- return the code block unadorned
      -- this probably could be improved
      return el
    end
  end,

  inner_content = function(extended_node)
    return {}
  end,

  set_inner_content = function(extended_node, values)
    return extended_node
  end,

  constructor = function(tbl)
    return {
      filename = tbl.filename,
      order = tbl.order,
      caption = tbl.caption,
      code_block = tbl.code_block
    }
  end
})
