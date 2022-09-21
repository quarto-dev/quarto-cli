---@meta

---@type string Format of the pandoc writer being used (html5, latex, etc.),
FORMAT = "html"

---@type pandoc.Version
PANDOC_VERSION = pandoc.types.Version('2.9.2')

---@type pandoc.Version
PANDOC_API_VERSION = pandoc.types.Version('1.22.1')

---@type string The name used to involve the filter. This value can be used to find files relative to the script file. 
PANDOC_SCRIPT_FILE = 'file'

---@type pandoc.ReaderOptions
PANDOC_READER_OPTIONS = {}

---@type pandoc.WriterOptions
PANDOC_WRITER_OPTIONS = {}

---@type pandoc.CommonState
PANDOC_STATE = {}
