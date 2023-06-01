#!/usr/bin/env lua
local runner = require("luacov.runner")

local patterns = {}
local configfile
local reporter

local help_message = ([[
LuaCov %s - coverage analyzer for Lua scripts

Usage:
   luacov [options] [pattern...]

   Launch your Lua programs with -lluacov to perform accounting.
   Launch this script to generate a report from collected stats.
   By default it reports on every Lua file encountered running your
   script. To filter filenames, pass one or more Lua patterns matching
   files to be included in the command line, or use a config.

Options:
   -c filename, --config filename

      Use a config file, .luacov by default. For details see
      luacov.defaults module.

   -r name, --reporter name

      Use a custom reporter - a module in luacov.reporter.* namespace.

   -h, --help

      Show this help message and exit.

Examples:
   luacov foo/bar

      This will report only on modules in the foo/bar subtree.
]]):format(runner.version)

-- pandoc doesn't support arg
arg = {}

local function read_key(i)
   if arg[i]:sub(1, 1) ~= "-" or #arg[i] == 1 then
      return nil, arg[i], i + 1
   end

   if arg[i]:sub(2, 2) == "-" then
      local key, value = arg[i]:match("^%-%-([^=]+)=(.*)$")
      if key then
         return key, value, i + 1
      else
         return arg[i]:sub(3), arg[i + 1], i + 2
      end
   else
      local key = arg[i]:sub(2, 2)
      local value = arg[i]:sub(3)
      if #value == 0 then
         i = i + 1
         value = arg[i]
      elseif value:sub(1, 1) == "=" then
         value = value:sub(2)
      end
      return key, value, i + 1
   end
end

local function norm_pat(p)
   return (p:gsub("\\", "/"):gsub("%.lua$", ""))
end

local i = 1
while arg[i] do
   local key, value
   key, value, i = read_key(i)
   if key then
      if (key == "h") or (key == "help") then
         print(help_message)
         os.exit(0)
      elseif (key == "c") or (key == "config") then
         configfile = value
      elseif (key == "r") or (key == "reporter") then
         reporter = value
      end
   else
      table.insert(patterns, norm_pat(value))
   end
end

-- will load configfile specified, or defaults otherwise
local configuration = runner.load_config(configfile)

configuration.include = configuration.include or {}
configuration.exclude = configuration.exclude or {}

-- add elements specified on commandline to config
for _, patt in ipairs(patterns) do
   table.insert(configuration.include, patt)
end

configuration.reporter = reporter or configuration.reporter
runner.run_report(configuration)
