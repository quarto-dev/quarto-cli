if pandoc.system.os == "mingw32" then

   local function get_windows_ansi_codepage()
      -- Reading the code page directly out of the registry was causing 
      -- Microsoft Defender to massively slow down pandoc (e.g. 1400ms instead of 140ms)
      -- So instead, look that up outside this filter and pass it in, which appears speed(ier)

      -- local pipe = assert(io.popen[[reg query HKLM\SYSTEM\CurrentControlSet\Control\Nls\CodePage /v ACP]])
      -- local codepage = pipe:read"*a":match"%sACP%s+REG_SZ%s+(.-)%s*$"
      -- pipe:close()
      -- return assert(codepage, "Failed to determine Windows ANSI codepage from Windows registry")
      local codepage = os.getenv("QUARTO_WIN_CODEPAGE")
      if codepage == nil then
         codepage = "1252"
      end
      return codepage
   end

   local codepage = get_windows_ansi_codepage()
   -- print("Your codepage is "..codepage)

   local success = pcall(function()
      pandoc.text.toencoding("test", "CP" .. codepage)
   end)
   if not success then
      error("Failed to convert to CP" .. codepage .. " encoding. Please check your codepage or set it explicitly with the QUARTO_WIN_CODEPAGE environment variable.")
      exit(1)
   end

   function convert_from_utf8(utf8str)
      return pandoc.text.toencoding(utf8str, "CP" .. codepage)
   end

   local orig_os_rename = os.rename

   function os.rename(old, new)
      return orig_os_rename(convert_from_utf8(old), convert_from_utf8(new))
   end

   local orig_os_remove = os.remove

   function os.remove(filename)
      return orig_os_remove(convert_from_utf8(filename))
   end

   local orig_os_execute = os.execute

   function os.execute(command)
      if command then
         command = convert_from_utf8(command)
      end
      return orig_os_execute(command)
   end

   local orig_io_open = io.open

   function io.open(filename, ...)
      return orig_io_open(convert_from_utf8(filename), ...)
   end

   local orig_io_popen = io.popen

   function io.popen(prog, ...)
      return orig_io_popen(convert_from_utf8(prog), ...)
   end

   local orig_io_lines = io.lines

   function io.lines(filename, ...)
      if filename then
         filename = convert_from_utf8(filename)
         return orig_io_lines(filename, ...)
      else
         return orig_io_lines()
      end
   end

   local orig_dofile = dofile

   function dofile(filename)
      if filename then
         filename = convert_from_utf8(filename)
      end
      return orig_dofile(filename)
   end

   local orig_loadfile = loadfile

   function loadfile(filename, ...)
      if filename then
         filename = convert_from_utf8(filename)
      end
      return orig_loadfile(filename, ...)
   end

   local orig_require = require

   function require(modname)
      modname = convert_from_utf8(modname)
      return orig_require(modname)
   end

   local orig_io_input = io.input

   function io.input(file)
      if type(file) == "string" then
         file = convert_from_utf8(file)
      end
      return orig_io_input(file)
   end

   local orig_io_output = io.output

   function io.output(file)
      if type(file) == "string" then
         file = convert_from_utf8(file)
      end
      return orig_io_output(file)
   end

end

-- Bootstrap our common libraries by adding our filter pandoc to the lib path
local sharePath = os.getenv("QUARTO_SHARE_PATH");
-- TODO: Need to ensure that we are resolving ahead of the other path
-- and understand consequences
-- Be aware of user filters which may be using require - need to be able load their modules safely
-- Maybe namespace quarto modules somehow or alter path for user filters
if sharePath ~= nil then 
  local sep = package.config:sub(1,1)
  package.path = package.path .. ";" .. sharePath .. sep .. 'pandoc' .. sep .. 'datadir' .. sep .. '?.lua'
end

-- dependency types that will be emitted to the dedendencies file
-- (use streamed json to write a single line of json for each dependency with
-- the type and the contents)
local kDependencyTypeHtml = "html";
local kDependencyTypeLatex = "latex";
local kDependencyTypeFile = "file";
local kDependencyTypeText = "text";

-- locations that dependencies may be injected
local kBeforeBody = "before-body";
local kAfterBody = "after-body";
local kInHeader = "in-header";

-- common requires
-- this is in the global scope - anyone downstream of init may use this
local format = require '_format'
local base64 = require '_base64'
local json = require '_json'
local utils = require '_utils'
local logging = require 'logging'

-- determines whether a path is a relative path
local function isRelativeRef(ref)
  return ref:find("^/") == nil and 
         ref:find("^%a+://") == nil and 
         ref:find("^data:") == nil and 
         ref:find("^#") == nil
end

-- This is a function that returns the current script
-- path. Shortcodes can use an internal function
-- to set and clear the local value that will be used 
-- instead of pandoc's filter path when a shortcode is executing
local scriptFile = {}

local function scriptDirs()
   if PANDOC_SCRIPT_FILE == nil then
      return {}
   end
   local dirs = { pandoc.path.directory(PANDOC_SCRIPT_FILE) }
   for i = 1, #scriptFile do
      dirs[#dirs+1] = pandoc.path.directory(scriptFile[i])
   end
   return dirs
end

local function scriptDir()
   if #scriptFile > 0 then
      return pandoc.path.directory(scriptFile[#scriptFile])
   else
      -- hard fallback
      return pandoc.path.directory(PANDOC_SCRIPT_FILE)
   end
end

-- splits a string on a separator
local function split(str, sep)
   local fields = {}
   
   local sep = sep or " "
   local pattern = string.format("([^%s]+)", sep)
   local _ignored = string.gsub(str, pattern, function(c) fields[#fields + 1] = c end)
   
   return fields
end

function is_absolute_path(path)
   if path:sub(1, pandoc.path.separator:len()) == pandoc.path.separator then
      return true
   end
   -- handle windows paths
   if path:sub(2, 2) == ":" and path:sub(3, 3) == pandoc.path.separator then
      return true
   end
   return false
end

local files_in_flight = {}
function absolute_searcher(modname)
   if not is_absolute_path(modname) then
      return nil -- not an absolute path, let someone else handle it
   end
   local function loader()
      local file_to_load = modname .. '.lua'
      if files_in_flight[file_to_load] then
         error("Circular dependency detected when attempting to load module: " .. file_to_load)
         error("The following files are involved:")
         for k, v in pairs(files_in_flight) do
            error("  " ..k)
         end
         os.exit(1)
      end
      files_in_flight[file_to_load] = true
      local result = dofile(file_to_load)
      files_in_flight[file_to_load] = nil
      return result
   end
   return loader
end
table.insert(package.searchers, 1, absolute_searcher)

-- TODO: Detect the root of the project and disallow paths
-- which are both outside of the project root and outside
-- quarto's own root
local function resolve_relative_path(path)
   local segments = split(path, pandoc.path.separator)
   local resolved = {}
   if path:sub(1, 1) == pandoc.path.separator then
      resolved[1] = ""
   end
   for i = 1, #segments do
      local segment = segments[i]
      if segment == ".." then
         resolved[#resolved] = nil
      elseif segment ~= "." then
         resolved[#resolved + 1] = segment
      end
   end
   return table.concat(resolved, pandoc.path.separator)
end

-- Add modules base path to package.path so we can require('modules/...') from
-- any path
package.path = package.path .. ';' .. pandoc.path.normalize(PANDOC_STATE.user_data_dir .. '/../../filters/?.lua')

-- patch require to look in current scriptDirs as well as supporting
-- relative requires
local orig_require = require
function require(modname)
   -- This supports relative requires. We need to resolve them carefully in two ways:
   --
   -- first, we need to ensure it is resolved relative to the current script.
   -- second, we need to make sure that different paths that resolve to the
   -- same file are cached as the same module.
   --
   -- this means we need to put ourselves in front of the standard require()
   -- call, since it checks cache by `modname` and we need to make sure that
   -- `modname` is always the same for the same file.
   --
   -- We achieve both by forcing the call to orig_require in relative requires
   -- to always take a fully-qualified path.
   --
   -- This strategy is not going to work in general, in the presence of symlinks
   -- and other things that can make two paths resolve to the same file. But
   -- it's good enough for our purposes.
   if modname:sub(1, 1) == "." then
      local calling_file = debug.getinfo(2, "S").source:sub(2, -1)
      local calling_dir = pandoc.path.directory(calling_file)
      if calling_dir == "." then
         -- resolve to current working directory
         calling_dir = scriptDir()
      end
      if calling_dir == "." then
         -- last-ditch effort, use the current working directory
         calling_dir = pandoc.system.get_working_directory()
      end
      local resolved_path = resolve_relative_path(pandoc.path.normalize(pandoc.path.join({calling_dir, modname})))
      return require(resolved_path)
   end
   local old_path = package.path
   local new_path = package.path
   local dirs = scriptDirs()
   for i, v in ipairs(dirs) do
      new_path = new_path .. ';' .. pandoc.path.join({v, '?.lua'})
   end

   package.path = new_path
   local mod = orig_require(modname)
   package.path = old_path
   return mod
end

if os.getenv("QUARTO_LUACOV") ~= nil then
   require("luacov")
end

-- resolves a path, providing either the original path
-- or if relative, a path that is based upon the 
-- script location
local function resolvePath(path)
  if isRelativeRef(path) then
    local wd = pandoc.system.get_working_directory()
    return pandoc.path.join({wd, pandoc.path.normalize(path)})
  else
    return path    
  end
end

local function resolvePathExt(path) 
  if isRelativeRef(path) then
    return resolvePath(pandoc.path.join({scriptDir(), pandoc.path.normalize(path)}))
  else
    return path
  end
end
-- converts the friendly Quartio location names 
-- in the pandoc location
local function resolveLocation(location) 
   if (location == kInHeader) then
     return "header-includes"
   elseif (location == kAfterBody) then
     return "include-after"
   elseif (location == kBeforeBody) then
     return "include-before"
   else
     error("Illegal value for dependency location. " .. location .. " is not a valid location.")
   end
 end 

-- Provides the path to the dependency file
-- The dependency file can be used to persist dependencies across filter
-- passes, but will also be inspected after pandoc is 
-- done running to deterine any files that should be copied
local function dependenciesFile()
  local dependenciesFile = os.getenv("QUARTO_FILTER_DEPENDENCY_FILE")
  if dependenciesFile == nil then
    error('Missing expected dependency file environment variable QUARTO_FILTER_DEPENDENCY_FILE')
  else
    return pandoc.utils.stringify(dependenciesFile)
  end
end

-- creates a dependency object
local function dependency(dependencyType, dependency) 
  return {
    type = dependencyType,
    content = dependency
  }
end

-- writes a dependency object to the dependency file
local function writeToDependencyFile(dependency)
  local dependencyJson = json.encode(dependency)
  local file = io.open(dependenciesFile(), "a")
  if file ~= nil then
     file:write(dependencyJson .. "\n")
     file:close()
  else
     fail('Error opening dependencies file at ' .. dependenciesFile())
  end
end

-- process a file dependency (read the contents of the file)
-- and include it verbatim in the specified location
local function processFileDependency(dependency, meta)
   -- read file contents
   local rawFile = dependency.content
   local f = io.open(pandoc.utils.stringify(rawFile.path), "r")
   if f ~= nil then
      local fileContents = f:read("*all")
      local blockFormat
      f:close()

      -- Determine the format with special treatment for verbatim HTML
      if format.isFormat("html") then
         blockFormat = "html"
      else
         blockFormat = FORMAT
      end
   
      -- place the contents of the file right where it belongs
      meta[rawFile.location]:insert(pandoc.Blocks({ pandoc.RawBlock(blockFormat, fileContents) }))
   else
      fail('Error reading dependencies from ' .. rawFile.path)
   end
 
   
 end

 -- process a text dependency, placing it in the specified location
local function processTextDependency(dependency, meta)
   local rawText = dependency.content
   local textLoc = rawText.location

   if meta[textLoc] == nil then
      meta[textLoc] = pandoc.List{}
   end
   meta[textLoc]:insert(pandoc.Blocks{pandoc.RawBlock(FORMAT, rawText.text)})
 end

 -- make the usePackage statement
local function usePackage(package, option)
   local text = ''
   if option == nil then
     text = "\\makeatletter\n\\@ifpackageloaded{" .. package .. "}{}{\\usepackage{" .. package .. "}}\n\\makeatother"
   else
     text = "\\makeatletter\n\\@ifpackageloaded{" .. package .. "}{}{\\usepackage[" .. option .. "]{" .. package .. "}}\n\\makeatother"
   end
   return pandoc.Blocks({ pandoc.RawBlock("latex", text) })
 end
  
 -- generate a latex usepackage statement
 local function processUsePackageDependency(dependency, meta)
   local rawPackage = dependency.content
   
   local headerLoc = resolveLocation(kInHeader)
   if meta[headerLoc] == nil then
      meta[headerLoc] = pandoc.List{}
   end
   meta[headerLoc]:insert(usePackage(rawPackage.package, rawPackage.options))
 end
 
 
-- process the dependencies that are present in the dependencies
-- file, injecting appropriate meta content and replacing
-- the contents of the dependencies file with paths to 
-- file dependencies that should be copied by Quarto
local function processDependencies(meta) 
   local dependenciesFile = dependenciesFile()

   -- holds a list of hashes for dependencies that
   -- have been processed. Process each dependency
   -- only once
   local injectedText = pandoc.List{}
   local injectedFile = pandoc.List{}
   local injectedPackage = pandoc.List{}

  -- each line was written as a dependency.
  -- process them and contribute the appropriate headers
  for line in io.lines(dependenciesFile) do
    local dependency = json.decode(line)
    if dependency.type == 'text' then
      if not utils.table.contains(injectedText, dependency.content) then
         processTextDependency(dependency, meta)
         injectedText:insert(dependency.content)
      end
    elseif dependency.type == "file" then
      if not utils.table.contains(injectedFile, dependency.content.path) then
         processFileDependency(dependency, meta)
         injectedFile:insert(dependency.content.path)
      end
    elseif dependency.type == "usepackage" then
      if not utils.table.contains(injectedPackage, dependency.content.package) then
         processUsePackageDependency(dependency, meta)
         injectedPackage:insert(dependency.content.package)
      end
    end
  end
end

-- resolves the file paths for an array/list of depependency files
local function resolveDependencyFilePaths(dependencyFiles) 
   if dependencyFiles ~= nil then
      for i,v in ipairs(dependencyFiles) do
         v.path = resolvePathExt(v.path)
      end
      return dependencyFiles
   else 
      return nil
   end
end

-- resolves the hrefs for an array/list of link tags
local function resolveDependencyLinkTags(linkTags)
   if linkTags ~= nil then
      for i, v in ipairs(linkTags) do
         v.href = resolvePath(v.href)
      end
      return linkTags
   else
      return nil
   end
end

-- Convert dependency files which may be just a string (path) or
-- incomplete objects into valid file dependencies
local function resolveFileDependencies(name, dependencyFiles)
   if dependencyFiles ~= nil then
 
     -- make sure this is an array
     if type(dependencyFiles) ~= "table" or not utils.table.isarray(dependencyFiles) then
       error("Invalid HTML Dependency: " .. name .. " property must be an array")
     end

 
     local finalDependencies = {}
     for i, v in ipairs(dependencyFiles) do
      if type(v) == "table" then
             -- fill in the name, if one is not provided
             if v.name == nil then
                v.name = pandoc.path.filename(v.path)
             end
             finalDependencies[i] = v
       elseif type(v) == "string" then
             -- turn a string into a name and path
             finalDependencies[i] = {
                name = pandoc.path.filename(v),
                path = v
             }
       else
             -- who knows what this is!
             error("Invalid HTML Dependency: " .. name .. " property contains an unexpected type.")
       end
     end
     return finalDependencies
   else
     return nil
   end
end

-- Convert dependency files which may be just a string (path) or
-- incomplete objects into valid file dependencies
local function resolveServiceWorkers(serviceworkers)
   if serviceworkers ~= nil then 
    -- make sure this is an array
     if type(serviceworkers) ~= "table" or not utils.table.isarray(serviceworkers) then
       error("Invalid HTML Dependency: serviceworkers property must be an array")
     end
 
     local finalServiceWorkers = {}
     for i, v in ipairs(serviceworkers) do
       if type(v) == "table" then
         -- fill in the destination as the root, if one is not provided
         if v.source == nil then
           error("Invalid HTML Dependency: a serviceworker must have a source.")
         else
           v.source = resolvePathExt(v.source)
         end
         finalServiceWorkers[i] = v

       elseif type(v) == "string" then
         -- turn a string into a name and path
         finalServiceWorkers[i] = {
            source = resolvePathExt(v)
         }
       else
         -- who knows what this is!
         error("Invalid HTML Dependency: serviceworkers property contains an unexpected type.")
       end
     end
     return finalServiceWorkers
   else
     return nil
   end
end

-- Lua Patterns for LaTeX Table Environment

--    1. \begin{table}[h] ... \end{table}
local latexTablePatternWithPos_table = { "\\begin{table}%[[^%]]+%]", ".*", "\\end{table}" }
local latexTablePattern_table = { "\\begin{table}", ".*", "\\end{table}" }

--    2. \begin{longtable}[c*]{l|r|r} 
--       FIXME: These two patterns with longtable align options do no account for newlines in options,
--       however pandoc will break align options over lines. This leads to specific treatment needed
--       as latexLongtablePattern_table will be the pattern, matching options in content.
--       see split_longtable_start() usage in src\resources\filters\customnodes\floatreftarget.lua
local latexLongtablePatternWithPosAndAlign_table = { "\\begin{longtable}%[[^%]]+%]{[^\n]*}", ".*", "\\end{longtable}" }
local latexLongtablePatternWithAlign_table = { "\\begin{longtable}{[^\n]*}", ".*", "\\end{longtable}" }
local latexLongtablePatternWithPos_table = { "\\begin{longtable}%[[^%]]+%]", ".*", "\\end{longtable}" }
local latexLongtablePattern_table = { "\\begin{longtable}", ".*", "\\end{longtable}" }

--    3. \begin{tabular}[c]{l|r|r}
local latexTabularPatternWithPosAndAlign_table = { "\\begin{tabular}%[[^%]]+%]{[^\n]*}", ".*", "\\end{tabular}" }
local latexTabularPatternWithPos_table = { "\\begin{tabular}%[[^%]]+%]", ".*", "\\end{tabular}" }
local latexTabularPatternWithAlign_table = { "\\begin{tabular}{[^\n]*}", ".*", "\\end{tabular}" }
local latexTabularPattern_table = { "\\begin{tabular}", ".*", "\\end{tabular}" }

-- Lua Pattern for Caption environment
local latexCaptionPattern_table = { "\\caption{", ".-", "}[^\n]*\n" }

-- global quarto params
local paramsJson = base64.decode(os.getenv("QUARTO_FILTER_PARAMS"))
local quartoParams = json.decode(paramsJson)

function param(name, default)
  local value = quartoParams[name]
  if value == nil then
    value = default
  end
  return value
end

local function projectDirectory() 
   return os.getenv("QUARTO_PROJECT_DIR")
end

local function projectOutputDirectory()
   local outputDir = param("project-output-dir", "")
   local projectDir = projectDirectory()
   if projectDir then
      return pandoc.path.join({projectDir, outputDir})
   else
      return nil
   end
end

-- Provides the project relative path to the current input
-- if this render is in the context of a project
local function projectRelativeOutputFile()
   
   -- the project directory
   local projDir = projectDirectory()

   -- the offset to the project
   if projDir then
      -- relative from project directory to working directory
      local workingDir = pandoc.system.get_working_directory()
      local projRelFolder = pandoc.path.make_relative(workingDir, projDir, false)
      
      -- add the file output name and normalize
      local projRelPath = pandoc.path.join({projRelFolder, PANDOC_STATE['output_file']})
      return pandoc.path.normalize(projRelPath);
   else
      return nil
   end
end

local function inputFile()
   local source = param("quarto-source", "")
   if pandoc.path.is_absolute(source) then 
      return source
   else
      local projectDir = projectDirectory()
      if projectDir then
         return pandoc.path.join({projectDir, source})
      else
         -- outside of a project, quarto already changes 
         -- pwd to the file's directory prior to calling pandoc,
         -- so we should just use the filename
         -- https://github.com/quarto-dev/quarto-cli/issues/7424
         local path_parts = pandoc.path.split(source)
         return pandoc.path.join({pandoc.system.get_working_directory(), path_parts[#path_parts]})
      end   
   end
end

local function outputFile() 
   local projectOutDir = projectOutputDirectory()
   if projectOutDir then
      local projectDir = projectDirectory()
      if projectDir then
         local input = pandoc.path.directory(inputFile())
         local relativeDir = pandoc.path.make_relative(input, projectDir)
         if relativeDir and relativeDir ~= '.' then
            return pandoc.path.join({projectOutDir, relativeDir, PANDOC_STATE['output_file']})
         end
      end
      return pandoc.path.join({projectOutDir, PANDOC_STATE['output_file']})
   else
      return pandoc.path.join({pandoc.system.get_working_directory(), PANDOC_STATE['output_file']})
   end
end

local function version()
   local versionString = param('quarto-version', 'unknown')
   local success, versionObject = pcall(pandoc.types.Version, versionString)
   if success then
      return versionObject
   else
      return versionString
   end
end

local function projectProfiles()
   return param('quarto_profile', {})
end

local function projectOffset() 
   return param('project-offset', nil)
end

local function file_exists(name)
   local f = io.open(name, 'r')
   if f ~= nil then
     io.close(f)
     return true
   else
     return false
   end
 end


 local function write_file(path, contents, mode)
   pandoc.system.make_directory(pandoc.path.directory(path), true)
   mode = mode or "a"
   local file = io.open(path, mode)
   if file then
     file:write(contents)
     file:close()
     return true
   else
     return false
   end
 end
 
 local function read_file(path)
   local file = io.open(path, "rb") 
   if not file then return nil end
   local content = file:read "*a"
   file:close()
   return content
 end

 local function remove_file(path) 
   return os.remove(path)
 end

-- Quarto internal module - makes functions available
-- through the filters
_quarto = {   
   processDependencies = processDependencies,
   format = format,
   -- Each list in patterns below contains Lua pattern as table,
   -- where elements are ordered from more specific match to more generic one.
   -- They are meant to be used with _quarto.modules.patterns.match_in_list_of_patterns()
   patterns = {
      latexTableEnvPatterns = pandoc.List({
         latexTablePatternWithPos_table, 
         latexTablePattern_table
      }),
      latexTabularEnvPatterns = pandoc.List({
         latexTabularPatternWithPosAndAlign_table,
         latexTabularPatternWithPos_table,
         latexTabularPatternWithAlign_table,
         latexTabularPattern_table
      }),
      latexLongtableEnvPatterns = pandoc.List({
         latexLongtablePatternWithPosAndAlign_table,
         latexLongtablePatternWithPos_table,
         latexLongtablePatternWithAlign_table,
         latexLongtablePattern_table
      }),
      -- This is all table env patterns
      latexAllTableEnvPatterns = pandoc.List({
         latexTablePatternWithPos_table,
         latexTablePattern_table,
         latexLongtablePatternWithPosAndAlign_table,
         latexLongtablePatternWithPos_table,
         latexLongtablePatternWithAlign_table,
         latexLongtablePattern_table,
         latexTabularPatternWithPosAndAlign_table,
         latexTabularPatternWithPos_table,
         latexTabularPatternWithAlign_table,
         latexTabularPattern_table,
      }),
      latexCaptionPatterns = pandoc.List({
         latexCaptionPattern_table
      })
   },
   traverser = utils.walk,
   utils = utils,
   withScriptFile = function(file, callback)
      table.insert(scriptFile, file)
      local result = callback()
      table.remove(scriptFile, #scriptFile)
      return result
   end,
   projectOffset = projectOffset,
   file = {
      read = read_file,
      write = function(path, contents) 
         return write_file(path, contents, "wb") 
      end,
      write_text = function(path, contents) 
         return write_file(path, contents, "a")
      end,
      exists = file_exists,
      remove = remove_file
   }
}

-- this injection here is ugly but gets around
-- a hairy order-of-import issue that would otherwise happen
-- because string_to_inlines requires some filter code that is only
-- later imported

_quarto.utils.string_to_inlines = function(s)
   return string_to_quarto_ast_inlines(s)
end 
_quarto.utils.string_to_blocks = function(s)
   return string_to_quarto_ast_blocks(s)
end
_quarto.utils.render = function(n)
   return _quarto.ast.walk(n, render_extended_nodes())
end

-- The main exports of the quarto module
quarto = {
  format = format,
  doc = {
    add_html_dependency = function(htmlDependency)
   
      -- validate the dependency
      if htmlDependency.name == nil then 
         error("HTML dependencies must include a name")
      end

      if htmlDependency.meta == nil and 
         htmlDependency.links == nil and 
         htmlDependency.scripts == nil and 
         htmlDependency.stylesheets == nil and 
         htmlDependency.resources == nil and
         htmlDependency.serviceworkers == nil and
         htmlDependency.head == nil then
         error("HTML dependencies must include at least one of meta, links, scripts, stylesheets, serviceworkers, or resources. All appear empty.")
      end

      -- validate that the meta is as expected
      if htmlDependency.meta ~= nil then
         if type(htmlDependency.meta) ~= 'table' then
               error("Invalid HTML Dependency: meta value must be a table")
         elseif utils.table.isarray(htmlDependency.meta) then
               error("Invalid HTML Dependency: meta value must must not be an array")
         end
      end

      -- validate link tags
      if htmlDependency.links ~= nil then
         if type(htmlDependency.links) ~= 'table' or not utils.table.isarray(htmlDependency.links) then
            error("Invalid HTML Dependency: links must be an array")
         else 
            for i, v in ipairs(htmlDependency.links) do
               if type(v) ~= "table" or (v.href == nil or v.rel == nil) then
                 error("Invalid HTML Dependency: each link must be a table containing both rel and href properties.")
               end
            end
         end
      end
   
      -- resolve names so they aren't required
      htmlDependency.scripts = resolveFileDependencies("scripts", htmlDependency.scripts)
      htmlDependency.stylesheets = resolveFileDependencies("stylesheets", htmlDependency.stylesheets)
      htmlDependency.resources = resolveFileDependencies("resources", htmlDependency.resources)

      -- pass the dependency through to the file
      writeToDependencyFile(dependency("html", {
         name = htmlDependency.name,
         version = htmlDependency.version,
         external = true,
         meta = htmlDependency.meta,
         links = resolveDependencyLinkTags(htmlDependency.links),
         scripts = resolveDependencyFilePaths(htmlDependency.scripts),
         stylesheets = resolveDependencyFilePaths(htmlDependency.stylesheets),
         resources = resolveDependencyFilePaths(htmlDependency.resources),
         serviceworkers = resolveServiceWorkers(htmlDependency.serviceworkers),
         head = htmlDependency.head,
      }))
    end,

    attach_to_dependency = function(name, pathOrFileObj)

      if name == nil then
         fail("The target dependency name for an attachment cannot be nil. Please provide a valid dependency name.")
      end

      -- path can be a string or an obj { name, path }
      local resolvedFile = {}
      if type(pathOrFileObj) == "table" then

         -- validate that there is at least a path
         if pathOrFileObj.path == nil then
            fail("Error attaching to dependency '" .. name .. "'.\nYou must provide a 'path' when adding an attachment to a dependency.")
         end

         -- resolve a name, if one isn't provided
         local name = pathOrFileObj.name      
         if name == nil then
            name = pandoc.path.filename(pathOrFileObj.path)
         end

         -- the full resolved file
         resolvedFile = {
            name = name,
            path = resolvePathExt(pathOrFileObj.path)
         }
      else
         resolvedFile = {
            name = pandoc.path.filename(pathOrFileObj),
            path = resolvePathExt(pathOrFileObj)
         }
      end

      writeToDependencyFile(dependency("html-attachment", {
         name = name,
         file = resolvedFile
      }))
    end,
  
    use_latex_package = function(package, options)
      writeToDependencyFile(dependency("usepackage", {package = package, options = options }))
    end,

    add_format_resource = function(path)
      writeToDependencyFile(dependency("format-resources", { file = resolvePathExt(path)}))
    end,

    add_resource = function(path)
      writeToDependencyFile(dependency("resources", { file = resolvePathExt(path)}))
    end,

    add_supporting = function(path)
      writeToDependencyFile(dependency("supporting", { file = resolvePathExt(path)}))
    end,

    include_text = function(location, text)
      writeToDependencyFile(dependency("text", { text = text, location = resolveLocation(location)}))
    end,
  
    include_file = function(location, path)
      writeToDependencyFile(dependency("file", { path = resolvePathExt(path), location = resolveLocation(location)}))
    end,

    is_format = format.isFormat,

    cite_method = function() 
      local citeMethod = param('cite-method', nil)
      return citeMethod
    end,
    pdf_engine = function() 
      local engine = param('pdf-engine', 'pdflatex')
      return engine      
    end,
    has_bootstrap = function() 
      local hasBootstrap = param('has-bootstrap', false)
      return hasBootstrap
    end,
    is_filter_active = function(filter)
      return quarto_global_state.active_filters[filter]
    end,

    output_file = outputFile(),
    input_file = inputFile(),
    crossref = {},
    language = param("language", nil)
  },
  project = {
    directory = projectDirectory(),
    offset = projectOffset(),
    profile = pandoc.List(projectProfiles()),
    output_directory = projectOutputDirectory()
  },
  utils = {
    dump = utils.dump,
    table = utils.table,
    type = utils.type,
    resolve_path = resolvePathExt,
    resolve_path_relative_to_document = resolvePath,
    as_inlines = utils.as_inlines,
    as_blocks = utils.as_blocks,
    is_empty_node = utils.is_empty_node,
    string_to_blocks = utils.string_to_blocks,
    string_to_inlines = utils.string_to_inlines,
    render = utils.render,
    match = utils.match,
    add_to_blocks = utils.add_to_blocks,
  },
  paths = {
     -- matches the path from `quartoEnvironmentParams` from src/command/render/filters.ts
    rscript = function()
      return param('quarto-environment', nil).paths.Rscript
    end,
    tinytex_bin_dir = function()
      return param('quarto-environment', nil).paths.TinyTexBinDir
    end,
    typst = function()
      return param('quarto-environment', nil).paths.Typst
    end,
  },
  json = json,
  base64 = base64,
  log = logging,
  version = version(),
  -- map to quartoConfig information on TS side
  config = {
    cli_path = function() return param('quarto-cli-path', nil) end,
    version = function() return version() end
  },
  shortcode = {
      read_arg = function (args, n)
         local arg = args[n or 1]
         local varName
         if arg == nil then
            return nil
         end
         if type(arg) ~= "string" then
            varName = inlinesToString(arg)
         else
            varName = arg --[[@as string]]
         end
         return varName
      end,
      error_output = function (shortcode, message_or_args, context)
         if type(message_or_args) == "table" then
            message_or_args = table.concat(message_or_args, " ")
         end
         local message = "?" .. shortcode .. ":" .. message_or_args
         if context == "block" then
            return pandoc.Blocks { pandoc.Strong( pandoc.Inlines { pandoc.Str(message) } ) }
          elseif context == "inline" then
            return pandoc.Inlines { pandoc.Strong( pandoc.Inlines { pandoc.Str(message) } ) }
          elseif context == "text" then
            return message
          else
            warn("Unknown context for " .. shortcode .. " shortcode error: " .. context)
            return { }
          end
      end,
  },
  metadata = {
    get = function(key)
      return option(key, nil)
    end
  },
  variables = {
    get = function(name)
      local value = var(name, nil)
      if value then
         value = pandoc.utils.stringify(value)
      end
      return value
    end
  }
}

-- alias old names for backwards compatibility
quarto.doc.addHtmlDependency = quarto.doc.add_html_dependency
quarto.doc.attachToDependency = quarto.doc.attach_to_dependency
quarto.doc.useLatexPackage = quarto.doc.use_latex_package
quarto.doc.addFormatResource = quarto.doc.add_format_resource
quarto.doc.includeText = quarto.doc.include_text
quarto.doc.includeFile = quarto.doc.include_file
quarto.doc.isFormat = quarto.doc.is_format
quarto.doc.citeMethod = quarto.doc.cite_method
quarto.doc.pdfEngine = quarto.doc.pdf_engine
quarto.doc.hasBootstrap = quarto.doc.has_bootstrap
quarto.doc.project_output_file = projectRelativeOutputFile
quarto.utils.resolvePath = quarto.utils.resolve_path

-- since Pandoc 3, pandoc.Null is no longer an allowed constructor.
-- this workaround makes it so that our users extensions which use pandoc.Null 
-- still work, assuming they call pandoc.Null() in a "simple" way.
pandoc.Null = function()
   return {}
end
