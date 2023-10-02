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
    return node.code_block
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
      -- if we have a filename, add it as a header
      return pandoc.Div(
        { pandoc.Plain{pandoc.Strong{pandoc.Str(node.filename)}}, el },
        pandoc.Attr("", {"code-with-filename"})
      )
    else
      return el
    end
  end)

  -- latex renderer
_quarto.ast.add_renderer("DecoratedCodeBlock",
  function(_)
    return _quarto.format.isLatexOutput()    
  end,
  function(node)
    local el = node.code_block
    -- add listing class to the code block
    el.attr.classes:insert("listing")

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

      listingDiv.content:insert(el)
      listingDiv.content:insert(pandoc.RawBlock("latex", "\\end{codelisting}"))
      return listingDiv
    end
    return el
  end)

-- html renderer
_quarto.ast.add_renderer("DecoratedCodeBlock", 
  function(_)
    return _quarto.format.isHtmlOutput()
  end,
  function(node)
    local el = node.code_block
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
  end)
