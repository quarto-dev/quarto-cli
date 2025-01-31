---@meta

---@module 'pandoc'
pandoc = {}

---@type table<string,boolean>
pandoc.readers = {}

---@type table<string,boolean>
pandoc.writers = {}

--[[
Pandoc document

Values of this type can be created with the`pandoc.Pandoc` constructor. Pandoc values are
equal in Lua if and only if they are equal in Haskell.
]]
---@class pandoc.Pandoc
---@field blocks pandoc.List Document content 
---@field meta pandoc.Meta Meta information
pandoc.Pandoc = {}

--[[
Create a complete pandoc document
]]
---@param blocks pandoc.Block|pandoc.List Document content 
---@param meta? pandoc.Meta Meta information
---@return pandoc.Pandoc
function pandoc.Pandoc(blocks, meta) end

--[[
Make a clone
]]
---@return pandoc.Pandoc
function pandoc.Pandoc:clone() end


--[[
Applies a Lua filter to the Pandoc element. Just as for
full-document filters, the order in which elements are traversed
can be controlled by setting the `traverse` field of the filter;
see the section on [traversal order][Traversal order]. Returns a
(deep) copy on which the filter has been applied: the original
element is left untouched.

Usage:

    -- returns `pandoc.Pandoc{pandoc.Para{pandoc.Str 'Bye'}}`
    return pandoc.Pandoc{pandoc.Para('Hi')}:walk {
      Str = function (_) return 'Bye' end,
    }
]]
---@param lua_filter table<string,function> Map of filter functions
---@return pandoc.Pandoc # Filtered document
function pandoc.Pandoc:walk(lua_filter) end

--[[
Runs command with arguments, passing it some input, and returns the output.
]]
---@param command string Program to run; the executable will be resolved using default system methods 
---@param args table List of arguments to pass to the program 
---@param input string Data which is piped into the program via stdin 
---@return string # Output of command, i.e. data printed to stdout
function pandoc.pipe(command, args, input) end

--[[
Apply a filter inside a block element, walking its contents.
Returns a (deep) copy on which the filter has been applied:
the original element is left untouched.
]]
---@generic T
---@param element `T` The block element
---@param filter table A Lua filter (table of functions) to be applied within the block element
---@return T # The transformed block element
function pandoc.walk_block(element, filter) end

--[[
-- Apply a filter inside an inline element, walking its contents.
-- Returns a (deep) copy on which the filter has been applied:
-- the original element is left untouched.
]]
---@generic T
---@param element `T` The inline element
---@param filter table A Lua filter (table of functions) to be applied within the inline element
---@return T # The transformed inline element
function pandoc.walk_inline(element, filter) end

--[[
Parse the given string into a Pandoc document.

The parser is run in the same environment that was used to read
the main input files; it has full access to the file-system and
the mediabag. This means that if the document specifies files to
be included, as is possible in formats like LaTeX,
reStructuredText, and Org, then these will be included in the
resulting document. Any media elements are added to those
retrieved from the other parsed input files.

The `format` parameter defines the format flavor that will be
parsed. This can be either a string, using `+` and `-` to enable
and disable extensions, or a table with fields `format` (string)
and `extensions` (table). The `extensions` table can be a list of
all enabled extensions, or a table with extensions as keys and
their activation status as values (`true` or `'enable'` to enable
an extension, `false` or `'disable'` to disable it).

Usage:

    local org_markup = "/emphasis/"  -- Input to be read
    local document = pandoc.read(org_markup, "org")
    -- Get the first block of the document
    local block = document.blocks[1]
    -- The inline element in that block is an `Emph`
    assert(block.content[1].t == "Emph")
]]
---@param markup string The markup to be parsed
---@param format? string|string[]|{format: string, extensions:string[]|table<string,boolean|"enable"|"disable">} Format specification, defaults to `"markdown"
---@param reader_options? pandoc.ReaderOptions|table Options passed to the reader; may be a ReaderOptions object or a table with a subset of the keys and values of a ReaderOptions object; defaults to the default values documented in the manual.  
---@return pandoc.Pandoc # Pandoc document
function pandoc.read(markup, format, reader_options) end

--[[
Converts a document to the given target format.

Usage:

    local doc = pandoc.Pandoc(
      {pandoc.Para {pandoc.Strong 'Tea'}}
    )
    local html = pandoc.write(doc, 'html')
    assert(html == "<p><strong>Tea</strong></p>")
]]
---@param doc pandoc.Pandoc Document to convert
---@param format? string|string[]|{format: string, extensions:string[]|table<string,boolean|"enable"|"disable">} Format specification, defaults to `html`
---@param writer_options? pandoc.WriterOptions|table<string,any> Options passed to the writer; may be a WriterOptions object or a table with a subset of the keys and values of a WriterOptions object.
---@return string # Converted document
function pandoc.write(doc, format, writer_options) end

--[[
Runs a classic custom Lua writer, using the functions defined
in the current environment.

Usage:

    -- Adding this function converts a classic writer into a
    -- new-style custom writer.
    function Writer (doc, opts)
      PANDOC_DOCUMENT = doc
      PANDOC_WRITER_OPTIONS = opts
      loadfile(PANDOC_SCRIPT_FILE)()
      return pandoc.write_classic(doc, opts)
    end
]]
---@param doc pandoc.Pandoc document to convert
---@param writer_options? pandoc.WriterOptions|table<string,any> options passed to the writer; may be a WriterOptions object or a table with a subset of the keys and values of a WriterOptions object; defaults to the default values documented in the manual.
---@return string # converted document
function pandoc.write_classic(doc, writer_options) end

