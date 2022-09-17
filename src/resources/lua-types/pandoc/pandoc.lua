---@meta

---@module 'pandoc'
pandoc = {}

---@type string Format of the pandoc writer being used (html5, latex, etc.),
FORMAT = "html"

---@type pandoc.types.Version
PANDOC_VERSION = pandoc.types.Version('2.9.2')

---@type pandoc.types.Version
PANDOC_API_VERSION = pandoc.types.Version('1.22.1')

---@type string The name used to involve the filter. This value can be used to find files relative to the script file. 
PANDOC_SCRIPT_FILE = 'file'

---@type pandoc.ReaderOptions
PANDOC_READER_OPTIONS = {}

---@type pandoc.WriterOptions
PANDOC_WRITER_OPTIONS = {}

---@type pandoc.CommonState
PANDOC_STATE = {}

--[[
Pandoc reader options
]]
---@class pandoc.ReaderOptions
---@field abbreviations string[] Set of known abbreviations
---@field columns integer Number of columns in terminal 
---@field default_image_extension string 
---@field extensions string[] String representation of the syntax extensions bit field 
---@field indented_code_classes pandoc.List Default classes for indented code blocks
---@field standalone boolean Whether the input was a standalone document with header
---@field strip_comments boolean HTML comments are stripped instead of parsed as raw HTML 
---@field tab_stop integer Width (i.e. equivalent number of spaces) of tab stops
---@field track_changes "accept-changes"|"reject-changes"|"all-changes" Track changes setting for docx; one of `accept-changes`, `reject-changes`, and `all-changes`

---@alias html_math_methods 'plain'|'gladtex'|'webtex'|'mathml'|'mathjax'

--[[
Table of the options that will be passed to the writer. While the object can be modified, the changes will not be picked up by pandoc.
]]
---@class pandoc.WriterOptions
---@field cite_method 'citproc'|'natbib'|'biblatex' How to print cites -- one of 'citeproc', 'natbib', or 'biblatex'
---@field columns integer Characters in a line (for text wrapping)
---@field dpi integer DPI for pixel to/from inch/cm conversions
---@field email_obfuscation 'none'|'references'|'javascript' How to obfuscate emails -- one of 'none', 'references', or 'javascript' 
---@field epub_chapter_level integer Header level for chapters, i.e., how the document is split into separate files 
---@field epub_fonts string[] Paths to fonts to embed 
---@field epub_metadata string? Metadata to include in EPUB 
---@field epub_subdirectory string  Subdir for epub in OCF 
---@field extensions string[] Markdown extensions that can be used 
---@field highlight_style table|nil Style to use for highlighting; see the output of `pandoc --print-highlight-style=...` for an example structure. The value `nil` means that no highlighting is used. 
---@field html_math_method html_math_methods|{ method: html_math_methods, url: string } How to print math in HTML; one 'plain', 'gladtex', 'webtex', 'mathml', 'mathjax', or a table with keys `method` and `url`.
---@field html_q_tags boolean Use `<q>` tags for quotes in HTML 
---@field identifier_prefix string  Prefix for section & note ids in HTML and for footnote marks in markdown 
---@field incremental boolean True if lists should be incremental
---@field listings boolean Use listings package for code 
---@field number_offset integer[] Starting number for section, subsection, ... (sequence of integers)
---@field number_sections boolean Number sections in LaTeX 
---@field prefer_ascii boolean Prefer ASCII representations of characters when possible
---@field reference_doc string|nil Path to reference document if specified 
---@field reference_links boolean Use reference links in writing markdown, rst
---@field reference_location 'end-of-block'|'end-of-section'|'end-of-document' Location of footnotes and references for writing markdown; one of 'end-of-block', 'end-of-section', 'end-of-document'.
---@field section_divs boolean Put sections in div tags in HTML 
---@field setext_headers boolean Use setext headers for levels 1-2 in markdown 
---@field slide_level integer|nil Force header level of slides 
---@field tab_stop integer Tabstop for conversion btw spaces and tabs
---@field table_of_contents boolean Include table of contents 
---@field template pandoc.types.Template|nil Template to use 
---@field toc_depth integer Number of levels to include in TOC
---@field top_level_division 'top-level-part'|'top-level-chapter'|'top-level-section'|'top-level-default' Type of top-level divisions; one of 'top-level-part', 'top-level-chapter', 'top-level-section', or 'top-level-default'.
---@field variables table<string,any> Variables to set in template; string-indexed table
---@field wrap_text 'wrap-auto'|'wrap-none'|'wrap-preserve' Option for wrapping text; one of 'wrap-auto', 'wrap-none', or 'wrap-preserve'. 

--[[
The state shared by all readers and writers. It is used by pandoc to collect and pass information.
]]
---@class pandoc.CommonState
---@field input_files pandoc.List List of input files from command line
---@field output_file string|nil Output file from command line 
---@field log pandoc.List A list of log messages in reverse order 
---@field request_headers table<string,string>  Headers to add for HTTP requests; table with header names as keys and header contents as value 
---@field resource_path pandoc.List Path to search for resources like included images
---@field source_url string|nil Absolute URL or directory of first source file
---@field user_data_dir string|nil Directory to search for data files 
---@field trace boolean Whether tracing messages are issued 
---@field verbosity 'INFO'|'WARNING'|'ERROR' Verbosity level; one of `INFO`, `WARNING`, `ERROR` 



--[[
Runs command with arguments, passing it some input, and returns the output.
]]
---@param command string Program to run; the executable will be resolved using default system methods 
---@param args string[] List of arguments to pass to the program 
---@param input string Data which is piped into the program via stdin 
---@return string Output of command, i.e. data printed to stdout
function pandoc.pipe(command, args, input)
end


return pandoc

