
_quarto.ast.add_handler({
  -- use either string or array of strings
  class_name = "my-custom-node",
  -- className = {"fancy-callout-warning", "fancy-callout-info", ... }

  -- optional: makePandocExtendedDiv
  -- supply makePandocExtendedDiv if you need to construct
  -- your want to create and extended pandoc Div
  -- 
  -- This is here as an escape hatch, we expect most developers
  -- to not need it.
  -- makePandocExtendedDiv = function(table)
  --   -- returns a pandoc Div that can be parsed back into a table
  --   -- later use
  -- end

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "MyCustomNode",

  -- a function that takes the extended ast node as supplied in user markdown
  -- and returns a new Pandoc node (use _quarto.ast.pandoc instead of pandoc if
  -- you need access to extended ast nodes)
  parse = function(div)
    return _quarto.ast.custom("MyCustomNode", {
      content = div.content[1]
    })
  end,

  -- a function that renders the extendedNode into output
  render = function(extendedNode)
    return pandoc.Div(pandoc.Blocks({
      pandoc.Para({"Custom Node preamble"}),
      extendedNode.content,
      pandoc.Para({"Custom Node postamble"})
    }))
  end,
})

return {}