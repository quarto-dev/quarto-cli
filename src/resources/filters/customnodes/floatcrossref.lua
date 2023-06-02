-- crossreffloat.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "FloatCrossref",

  -- generic names this custom AST node responds to
  -- this is still unimplemented
  generics = {"Crossref"},

  -- float crossrefs are always blocks
  kind = "Block",

  parse = function(div)
    fail("FloatCrossref nodes should not be parsed")
  end,

  slots = { "content", "caption_long", "caption_short" },

  constructor = function(tbl)
    return tbl
  end
})


-- _quarto.ast.add_handler({

--   -- empty table so this handler is only called programmatically
--   class_name = {},

--   -- the name of the ast node, used as a key in extended ast filter tables
--   ast_name = "FloatSubCrossref",

--   -- generic names this custom AST node responds to
--   -- this is still unimplemented
--   generics = {"Crossref"},

--   -- float crossrefs are always blocks
--   kind = "Block",

--   parse = function(div)
--     fail("FloatSubCrossref nodes should not be parsed")
--   end,

--   slots = { "content" },

--   constructor = function(tbl)
--     return {
--       type = tbl.type,
--     }
--   end,

-- })