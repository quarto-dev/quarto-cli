---@meta

--[[

Access to the higher-level document structure, including hierarchical
sections and the table of contents.

]]
---@module 'pandoc.structure'
pandoc.structure = {}
--[[

Puts [Blocks](#type-blocks) into a hierarchical structure: a list of
sections (each a Div with class "section" and first element a Header).

The optional `opts` argument can be a table; two settings are
recognized: If `number_sections` is true, a `number` attribute
containing the section number will be added to each `Header`. If
`base_level` is an integer, then `Header` levels will be reorganized so
that there are no gaps, with numbering levels shifted by the given
value. Finally, an integer `slide_level` value triggers the creation of
slides at that heading level.

Note that a [WriterOptions](#type-writeroptions) object can be passed as
the opts table; this will set the `number_section` and `slide_level`
values to those defined on the command line.

Usage:

    local blocks = {
      pandoc.Header(2, pandoc.Str 'first'),
      pandoc.Header(2, pandoc.Str 'second'),
    }
    local opts = PANDOC_WRITER_OPTIONS
    local newblocks = pandoc.structure.make_sections(blocks, opts)

]]
---@param blocks pandoc.Blocks document blocks to process
---@param opts? table options
---@return pandoc.Blocks[] # processed blocks
function pandoc.structure.make_sections(blocks, opts) end

--[[
Find level of header that starts slides (defined as the least header
level that occurs before a non-header/non-hrule in the blocks).
]]
---@param blocks pandoc.Pandoc|pandoc.Blocks document body
---@return integer # slide level
function pandoc.structure.slide_level(blocks) end

--[[
Converts a [Pandoc](#type-pandoc) document into a
[ChunkedDoc](#type-chunkeddoc).

The following option fields are supported:

    `path_template`
    :   template used to generate the chunks' filepaths
        `%n` will be replaced with the chunk number (padded with
        leading 0s to 3 digits), `%s` with the section number of
        the heading, `%h` with the (stringified) heading text,
        `%i` with the section identifier. For example,
        `"section-%s-%i.html"` might be resolved to
        `"section-1.2-introduction.html"`.

        Default is `"chunk-%n"` (string)

    `number_sections`
    :   whether sections should be numbered; default is `false`
        (boolean)

    `chunk_level`
    :   The heading level the document should be split into
        chunks. The default is to split at the top-level, i.e.,
        `1`. (integer)

    `base_heading_level`
    :   The base level to be used for numbering. Default is `nil`
        (integer|nil)
]]
---@param doc pandoc.Pandoc document to split
---@param opts? {path_template: string, number_sections: boolean, chunk_level: integer, base_heading_level: integer|nil} Options. see documentation body for details
---@return pandoc.ChunkedDoc
function pandoc.structure.split_into_chunks(doc, opts) end

--[[
Generates a table of contents for the given object.
]]
---@param toc_source pandoc.Blocks|pandoc.Pandoc|pandoc.ChunkedDoc list of command line arguments
---@param opts? pandoc.WriterOptions options
---@return pandoc.Block # Table of contents as a BulletList object
function pandoc.structure.table_of_contents(toc_source, opts) end

--[[
Part of a document; usually chunks are each written to a separate
file.
]]
---@class pandoc.Chunk
---@field heading pandoc.Inlines heading text
---@field id string identifier
---@field level integer level of topmost heading in chunk
---@field number integer chunk number
---@field section_number string hierarchical section number
---@field path string target filepath for this chunk
---@field up pandoc.Chunk|nil link to the enclosing section, if any
---@field prev pandoc.Chunk|nil link to the previous section, if any
---@field next pandoc.Chunk|nil link to the next section, if any
---@field unlisted boolean whether the section in this chunk should be listed in the TOC even if the chunk has no section number.
---@field contents pandoc.Blocks the chunk's block contents 
pandoc.Chunk = {}

--[[
A Pandoc document divided into `Chunk`s.

The table of contents info in field `toc` is rose-tree structure
represented as a list. The node item is always placed at index
`0`; subentries make up the rest of the list. Each node item
contains the fields `title` ([Inlines][]), `number` (string|nil),
`id` (string), `path` (string), and `level` (integer).  
]]
---@class pandoc.ChunkedDoc
---@field chunks pandoc.Chunk[] list of chunks that make up the document
---@field meta pandoc.Meta the document's metadata
---@field toc table table of contents information
pandoc.ChunkedDoc = {}