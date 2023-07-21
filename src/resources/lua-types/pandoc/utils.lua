---@meta

---@module 'pandoc.utils'
pandoc.utils = {}

--[[
Squash a list of blocks into a list of inlines.

Usage:

    local blocks = {
      pandoc.Para{ pandoc.Str 'Paragraph1' },
      pandoc.Para{ pandoc.Emph 'Paragraph2' }
    }
    local inlines = pandoc.utils.blocks_to_inlines(blocks)
    -- inlines = {
    --   pandoc.Str 'Paragraph1',
    --   pandoc.Space(), pandoc.Str'¶', pandoc.Space(),
    --   pandoc.Emph{ pandoc.Str 'Paragraph2' }
    -- }
]]
---@param blocks pandoc.List List of `Block` elements to be flattened.
---@param sep? pandoc.List List of `Inline` elements inserted as separator between two consecutive blocks; defaults to `{pandoc.LineBreak()}`.
---@return pandoc.List
function pandoc.utils.blocks_to_inlines(blocks, sep) end

--[[
Process the citations in the file, replacing them with rendered
citations and adding a bibliography. See the manual section on
citation rendering for details.

Usage:

    -- Lua filter that behaves like `--citeproc`
    function Pandoc (doc)
      return pandoc.utils.citeproc(doc)
    end
]]
---@param doc pandoc.Pandoc Document to process
---@return pandoc.Pandoc # Processed document
function pandoc.utils.citeproc(doc) end

--[[
Test equality of AST elements. Elements in Lua are considered
equal if and only if the objects obtained by unmarshaling are
equal.

**This function is deprecated.** Use the normal Lua `==` equality
operator instead.
]]
---@param element1 any Object to be compared
---@param element2 any Object to be compared
---@return boolean # Whether the two objects represent the same element
function pandoc.utils.equals(element1, element2) end

--[[
Creates a `Table` block element from a `SimpleTable`. This is
useful for dealing with legacy code which was written for pandoc
versions older than 2.10.

-- Usage:

    local simple = pandoc.SimpleTable(table)
    -- modify, using pre pandoc 2.10 methods
    simple.caption = pandoc.SmallCaps(simple.caption)
    -- create normal table block again
    table = pandoc.utils.from_simple_table(simple)
]]
---@param table pandoc.SimpleTable
---@return pandoc.Table
function pandoc.utils.from_simple_table(table) end

--[[
Converts list of `Block` elements into sections.
`Div`s will be created beginning at each `Header`
and containing following content until the next `Header`
of comparable level.  If `number_sections` is true,
a `number` attribute will be added to each `Header`
containing the section number. If `base_level` is
non-null, `Header` levels will be reorganized so
that there are no gaps, and so that the base level
is the level specified.

**Deprecated** Use `pandoc.structure.make_sections` instead.
]]
---@param number_sections boolean Whether section divs should get an additional `number` attribute containing the section number.
---@param base_level integer|nil Shift top-level headings to this level.
---@return pandoc.Blocks
function pandoc.utils.make_sections(number_sections, base_level, blocks) end

--[[
Get references defined inline in the metadata and via an external
bibliography. Only references that are actually cited in the
document (either with a genuine citation or with `nocite`) are
returned. URL variables are converted to links.

The structure used represent reference values corresponds to that
used in CSL JSON; the return value can be use as `references`
metadata, which is one of the values used by pandoc and citeproc
when generating bibliographies.

Usage:

    -- Include all cited references in document
    function Pandoc (doc)
      doc.meta.references = pandoc.utils.references(doc)
      doc.meta.bibliography = nil
      return doc
    end
]]
---@param doc pandoc.Pandoc Document
---@return table # List of references
function pandoc.utils.references(doc) end


--[[
Filter the given doc by passing it through the a JSON filter.

Usage:

    -- Assumes `some_blocks` contains blocks for which a
    -- separate literature section is required.
    local sub_doc = pandoc.Pandoc(some_blocks, metadata)
    sub_doc_with_bib = pandoc.utils.run_json_filter(
      sub_doc,
      'pandoc-citeproc'
    )
    some_blocks = sub_doc.blocks -- some blocks with bib
]]
---@param doc pandoc.Pandoc The document to filter
---@param filter string Path of filter to run
---@param args? table List of arguments to pass to filter. Defaults to `{FORMAT}`
function pandoc.utils.run_json_filter(doc, filter, args) end

--[[
Parse a date and convert (if possible) to "YYYY-MM-DD" format.
We limit years to the range 1601-9999 (ISO 8601 accepts greater
than or equal to 1583, but MS Word only accepts dates starting
1601).
]]
---@param date_string string Date to be normalized
---@return string|nil # A data string, nor `nil` when the converstion failed 
function pandoc.utils.normalize_date(date_string) end


--[[
Returns the SHA1 has of the contents.

Usage:

    local fp = pandoc.utils.sha1("foobar")
]]
---@param contents string Contents to be hashed
---@return string # SHA1 hash of the contents
function pandoc.utils.sha1(contents) end

--[[
Converts the given element (Pandoc, Meta, Block, or Inline) into
a string with all formatting removed.

Usage:

    local inline = pandoc.Emph{pandoc.Str 'Moin'}
    -- outputs "Moin"
    print(pandoc.utils.stringify(inline))
]]
---@param element any
---@return string # A plain string representation of the given element
function pandoc.utils.stringify(element) end

--[[
Converts an integer < 4000 to uppercase roman numeral.
]]
---@param value integer Value to convert
---@return string # A roman numeral string
function pandoc.utils.to_roman_numeral(value) end

--[[
Creates a `SimpleTable` out of a `Table` block.

Usage:

    local simple = pandoc.utils.to_simple_table(table)
    -- modify, using pre pandoc 2.10 methods
    simple.caption = pandoc.SmallCaps(simple.caption)
    -- create normal table block again
    table = pandoc.utils.from_simple_table(simple)
]]
---@param table pandoc.Table Table to convert
---@return pandoc.SimpleTable 
function pandoc.utils.to_simple_table(table) end

--[[
Pandoc-friendly version of Lua's default `type` function,
returning the type of a value. This function works with all types
listed in section [Lua type reference][], except if noted
otherwise.

The function works by checking the metafield `__name`. If the
argument has a string-valued metafield `__name`, then it returns
that string. Otherwise it behaves just like the normal `type`
function.

Usage:

    -- Prints one of 'string', 'boolean', 'Inlines', 'Blocks',
    -- 'table', and 'nil', corresponding to the Haskell constructors
    -- MetaString, MetaBool, MetaInlines, MetaBlocks, MetaMap,
    -- and an unset value, respectively.
    function Meta (meta)
      print('type of metavalue `author`:', pandoc.utils.type(meta.author))
    end
]]
---@param value any Any Lua value
---@return string # Type of the given value
function pandoc.utils.type(value) end


return pandoc.utils