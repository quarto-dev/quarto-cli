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

  -- DecoratedCodeblocks will be rendered as blocks
  kind = "Block",

  slots = { "code_block" },

  -- a function that takes the div node as supplied in user markdown
  -- and returns the custom node
  parse = function(div)
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end,

  constructor = function(tbl)
    return tbl
  end
})

-- default renderer
-- return the code block unadorned
-- this probably could be improved
_quarto.ast.add_renderer("DecoratedCodeBlock",
  function(_)
    return true
  end,
  function(node)
    return _quarto.ast.walk(node.code_block, {
      CodeBlock = render_folded_block
    })
  end)

-- markdown renderer
_quarto.ast.add_renderer("DecoratedCodeBlock",
  function(_)
    return _quarto.format.isMarkdownOutput()    
  end,
  function(node)
    local el = node.code_block
    -- see https://github.com/quarto-dev/quarto-cli/issues/5112
    -- 
    -- This is a narrow fix for the 1.3 regression.
    -- We still don't support listings output in markdown since that wasn't supported in 1.2 either.
    -- But that'll be done in 1.4 with crossrefs overhaul.

    if node.filename then
      -- a user filter could have replaced
      -- a single code block in a decorated code block with a list of elements,
      -- so we need to handle that.
      local blocks = quarto.utils.as_blocks(el) or pandoc.Blocks({})
      -- if we have a filename, add it as a header
      blocks:insert(1, pandoc.Plain{pandoc.Strong{pandoc.Str(node.filename)}})
      return pandoc.Div(
        blocks,
        pandoc.Attr("", {"code-with-filename"})
      )
    else
      return _quarto.ast.walk(quarto.utils.as_blocks(el), {
        CodeBlock = render_folded_block
      })
    end
  end)

  -- latex renderer
_quarto.ast.add_renderer("DecoratedCodeBlock",
  function(_)
    return _quarto.format.isLatexOutput()    
  end,
  function(node)
    -- add listing class to the code block
    -- need to walk the code block instead of assigning directly
    -- because upstream filters might have replaced the code block with
    -- more than one element
    node.code_block = _quarto.ast.walk(quarto.utils.as_blocks(node.code_block), {
      CodeBlock = function(el)
        el.attr.classes:insert("listing")
        return render_folded_block(el)
      end
    }) or node.code_block -- unneeded but the Lua analyzer doesn't know that

    -- if we are use the listings package we don't need to do anything
    -- further, otherwise generate the listing div and return it
    if not param("listings", false) then
      local listingDiv = pandoc.Div({})
      local position = ""
      if _quarto.format.isBeamerOutput() then
        -- Adjust default float positionment for beamer (#5536)
        position = "[H]"
      end
      listingDiv.content:insert(pandoc.RawBlock("latex", "\\begin{codelisting}" .. position))

      local captionContent = node.caption

      if node.filename ~= nil and captionContent ~= nil then
        -- with both filename and captionContent we need to add a colon
        local listingCaption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
        listingCaption.content:insert(
          pandoc.RawInline("latex", "\\texttt{" .. stringEscape(node.filename, "latex") .. "}: ")
        )
        listingCaption.content:extend(captionContent)
        listingCaption.content:insert(pandoc.RawInline("latex", "}"))
        listingDiv.content:insert(listingCaption)
      elseif node.filename ~= nil and captionContent == nil then
        local listingCaption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
        -- with just filename we don't add a colon
        listingCaption.content:insert(
          pandoc.RawInline("latex", "\\texttt{" .. stringEscape(node.filename, "latex") .. "}")
        )
        listingCaption.content:insert(pandoc.RawInline("latex", "}"))
        listingDiv.content:insert(listingCaption)
      elseif node.filename == nil and captionContent ~= nil then
        local listingCaption = pandoc.Plain({pandoc.RawInline("latex", "\\caption{")})
        listingCaption.content:extend(captionContent)
        listingCaption.content:insert(pandoc.RawInline("latex", "}"))
        listingDiv.content:insert(listingCaption)
      end

      -- a user filter could have replaced
      -- a single code block in a decorated code block with a list of elements,
      -- so we need to handle that.
      listingDiv.content:extend(quarto.utils.as_blocks(node.code_block) or {})
      listingDiv.content:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))
      return listingDiv
    end
    return node.code_block
  end)

-- html renderer
_quarto.ast.add_renderer("DecoratedCodeBlock", 
  function(_)
    return _quarto.format.isHtmlOutput()
  end,
  function(node)
    if node.filename == nil then
      return _quarto.ast.walk(quarto.utils.as_blocks(node.code_block), {
        CodeBlock = render_folded_block
      })
    end
    local el = node.code_block
    local filenameEl
    local caption
    local classes = pandoc.List()
    filenameEl = pandoc.Div({pandoc.Plain{
      pandoc.RawInline("html", "<pre>"),
      pandoc.Strong{pandoc.Str(node.filename)},
      pandoc.RawInline("html", "</pre>")
    }}, pandoc.Attr("", {"code-with-filename-file"}))
    classes:insert("code-with-filename")

    local blocks = pandoc.Blocks({})
    if caption ~= nil then
      blocks:insert(caption)
    end
    el = _quarto.ast.walk(quarto.utils.as_blocks(el), {
      CodeBlock = render_folded_block
    }) or pandoc.Blocks({})
    if filenameEl ~= nil then
      el = _quarto.ast.walk(quarto.utils.as_blocks(el), {
        CodeBlock = function(block)
          return pandoc.Blocks({
            filenameEl,
            block
          })
        end
      }) or pandoc.Blocks({})
    end
    blocks:extend(el)

    return pandoc.Div(blocks, pandoc.Attr("", classes))
  end)
