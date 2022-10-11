---@meta

quarto.project = {}

---@type string|nil Full path to current project directory (`nil` if no project)
quarto.project.directory = ""

---@type string|nil Full path to current project output directory (`nil` if no project)
quarto.project.output_directory = ""

---@type string|nil Offset (relative path) from the directory of the current file to the root of the project (`nil` if no project)
quarto.project.offset = ""

---@type pandoc.List List of currently active project profiles
quarto.project.profiles = pandoc.List()



